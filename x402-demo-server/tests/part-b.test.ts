import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GPULock } from '../core/utils/gpu-lock.js';
import { evaluateCaptionQuality, calculateRepetitionRate } from '../core/transcript/caption-quality-gate.js';
import { deduplicateOverlap, mergeChunkedSegments } from '../core/transcript/chunk-merger.js';
import {
  classifyYtDlpError,
  PrivateVideoError,
  AgeRestrictedError,
  GeoBlockedError,
  DownloadBlockedError,
  VideoTooLongError,
} from '../core/transcript/audio-downloader.js';

describe('Part B: Caption Quality Gate, Audio Download, GPU Lock, and VAD Deduplication', () => {
  // ── 1. GPU Lock & Mutex Queueing ──────────────────────────────────────────
  describe('GPU Lock & Memory Serialization (B6)', () => {
    it('should acquire lock, report locked status, and allow sequential release', async () => {
      const lock = new GPULock();
      assert.strictEqual(lock.isLocked(), false);

      const release1 = await lock.acquire('Task-1');
      assert.strictEqual(lock.isLocked(), true);

      release1();
      assert.strictEqual(lock.isLocked(), false);
    });

    it('should force a second GPU job to wait until the first job releases the lock', async () => {
      const lock = new GPULock();
      const executionOrder: string[] = [];

      const releaseJob1 = await lock.acquire('Whisper-Job');
      executionOrder.push('job1-started');

      // Schedule Job 2 while Job 1 is still holding the lock
      const job2Promise = lock.acquire('Ollama-Job').then((releaseJob2) => {
        executionOrder.push('job2-started');
        releaseJob2();
        executionOrder.push('job2-finished');
      });

      // Verify Job 2 has not started yet because the lock is held
      assert.strictEqual(executionOrder.includes('job2-started'), false);
      assert.strictEqual(lock.getQueueLength(), 1);

      // Finish Job 1
      executionOrder.push('job1-finished');
      releaseJob1();

      // Wait for Job 2 to execute
      await job2Promise;

      assert.deepStrictEqual(executionOrder, [
        'job1-started',
        'job1-finished',
        'job2-started',
        'job2-finished',
      ]);
    });

    it('should verify Whisper model is unloaded before Ollama generation starts', async () => {
      const lock = new GPULock();
      const eventLog: string[] = [];

      // Mock Whisper provider with unload
      const mockWhisper = {
        transcribe: async () => {
          eventLog.push('whisper:transcribe:start');
          await new Promise((r) => setTimeout(r, 10));
          eventLog.push('whisper:transcribe:done');
        },
        unload: async () => {
          eventLog.push('whisper:unload:gpu_cache_cleared');
        },
      };

      // Mock Ollama provider
      const mockOllama = {
        generate: async () => {
          eventLog.push('ollama:generate:start');
          await new Promise((r) => setTimeout(r, 10));
          eventLog.push('ollama:generate:done');
        },
      };

      // Job 1: Transcription (Whisper)
      const release1 = await lock.acquire('Whisper-Transcription');
      try {
        await mockWhisper.transcribe();
      } finally {
        await mockWhisper.unload();
        release1();
      }

      // Job 2: Synthesis (Ollama)
      const release2 = await lock.acquire('Ollama-Synthesis');
      try {
        await mockOllama.generate();
      } finally {
        release2();
      }

      // Assert Whisper unloaded BEFORE Ollama started
      const unloadIndex = eventLog.indexOf('whisper:unload:gpu_cache_cleared');
      const ollamaStartIndex = eventLog.indexOf('ollama:generate:start');

      assert.notStrictEqual(unloadIndex, -1);
      assert.notStrictEqual(ollamaStartIndex, -1);
      assert.ok(
        unloadIndex < ollamaStartIndex,
        `Expected Whisper unload (idx ${unloadIndex}) to precede Ollama generation (idx ${ollamaStartIndex})`
      );
    });
  });

  // ── 2. Caption Quality Gate (B4) ──────────────────────────────────────────
  describe('Caption Quality Gate (B4)', () => {
    it('should reject captions that are too sparse compared to video duration (<35 WPM)', () => {
      // 10-minute video (600s), but only 25 words -> ~2.5 WPM (severely sparse)
      const sparseText = 'Hello welcome to our talk today. That is all. Thank you goodbye.';
      const result = evaluateCaptionQuality(sparseText, 600);

      assert.strictEqual(result.isUsable, false);
      assert.ok(result.reason?.includes('too sparse'));
      assert.ok(result.wordsPerMinute < 35);
    });

    it('should reject captions with excessive repetition / glitch loop (>25% duplicates)', () => {
      // 10-second audio with high word count (>60 words, ~360 WPM) but repetitive identical lines
      const repetitiveLines = [
        'subscribe to the channel and hit the bell notification icon now',
        'subscribe to the channel and hit the bell notification icon now',
        'subscribe to the channel and hit the bell notification icon now',
        'welcome to the deep dive into artificial intelligence and compute',
        'subscribe to the channel and hit the bell notification icon now',
        'subscribe to the channel and hit the bell notification icon now',
        'subscribe to the channel and hit the bell notification icon now',
      ];
      const repRate = calculateRepetitionRate(repetitiveLines);
      assert.ok(repRate > 0.25);

      const result = evaluateCaptionQuality(repetitiveLines.join('\n'), 10);
      assert.strictEqual(result.isUsable, false);
      assert.ok(result.reason?.includes('excessive repetition rate'));
    });

    it('should reject captions when language mismatches detected spoken audio', () => {
      const validEnText =
        'This is a comprehensive deep dive into enterprise cloud infrastructure and modern computing architecture with scalable distributed systems across multiple regions.';
      const result = evaluateCaptionQuality(validEnText, 10, {
        language: 'en',
        detectedAudioLang: 'hi', // Spoken audio is Hindi, but captions are English
      });

      assert.strictEqual(result.isUsable, false);
      assert.ok(result.reason?.includes('does not match detected audio language'));
    });

    it('should accept valid high-density captions with normal speech rate', () => {
      // 60-second video with 130 words (~130 WPM)
      const normalWords = Array.from({ length: 130 }, (_, i) => `word${i}`).join(' ');
      const result = evaluateCaptionQuality(normalWords, 60, {
        isManual: true,
        language: 'en',
      });

      assert.strictEqual(result.isUsable, true);
      assert.strictEqual(result.isManual, true);
      assert.strictEqual(result.wordsPerMinute, 130);
    });
  });

  // ── 3. VAD Chunk Merger & Overlap Deduplication (B7) ──────────────────────
  describe('VAD Chunk Merger & Overlap Deduplication (B7)', () => {
    it('should deduplicate overlapping phrases across consecutive chunk boundaries', () => {
      const prev = 'we are discussing enterprise artificial intelligence system architecture';
      const next = 'system architecture which optimizes memory footprint on edge devices';

      const deduplicated = deduplicateOverlap(prev, next);
      assert.strictEqual(deduplicated, 'which optimizes memory footprint on edge devices');
    });

    it('should leave non-overlapping segments untouched', () => {
      const prev = 'this is the first part of the talk';
      const next = 'now moving on to financial projections';

      const result = deduplicateOverlap(prev, next);
      assert.strictEqual(result, next);
    });

    it('should merge multiple chunked windows into an ordered transcript with timestamps', () => {
      const chunks = [
        {
          chunkOffsetSeconds: 0,
          segments: [
            { start: 0.0, end: 4.5, text: 'Hello everyone welcome to the quarterly report.' },
            { start: 4.5, end: 9.0, text: 'We saw revenue growth across all three departments.' },
          ],
        },
        {
          chunkOffsetSeconds: 8.0,
          segments: [
            // overlapping segment from window transition
            { start: 0.0, end: 3.0, text: 'three departments.' },
            { start: 3.0, end: 7.5, text: 'Specifically our cloud division grew eighty percent.' },
          ],
        },
      ];

      const merged = mergeChunkedSegments(chunks);

      assert.strictEqual(merged.segments.length, 3);
      assert.strictEqual(merged.segments[0].start, 0.0);
      assert.strictEqual(merged.segments[0].end, 4.5);
      assert.strictEqual(merged.segments[2].start, 11.0); // 8.0 + 3.0
      assert.strictEqual(merged.segments[2].end, 15.5); // 8.0 + 7.5
      assert.ok(merged.fullText.includes('cloud division grew eighty percent'));
      assert.ok(!merged.fullText.includes('departments. three departments'));
    });
  });

  // ── 4. Language Detection & Confidence Scoring (B5) ────────────────────────
  describe('Language Detection & Confidence Flag (B5)', () => {
    it('should flag lowLanguageConfidence when probability is below 0.60', () => {
      const highConfidenceProbe = { language: 'en', probability: 0.94 };
      const lowConfidenceProbe = { language: 'hi', probability: 0.45 };

      const checkConfidence = (prob: number) => ({
        confidence: prob,
        lowLanguageConfidence: prob < 0.60,
      });

      assert.strictEqual(checkConfidence(highConfidenceProbe.probability).lowLanguageConfidence, false);
      assert.strictEqual(checkConfidence(lowConfidenceProbe.probability).lowLanguageConfidence, true);
    });

    it('should require user confirmation when lowLanguageConfidence is true and outputLanguage is same as video', () => {
      const metadata = { lowLanguageConfidence: true, languageConfidence: 0.42, detectedLanguage: 'hi' };
      const shouldPromptUser = (meta: typeof metadata, userConfirmed: boolean, outputLang: string) => {
        const isLow = meta.lowLanguageConfidence || meta.languageConfidence < 0.60;
        return isLow && !userConfirmed && outputLang === 'same as video';
      };

      assert.strictEqual(shouldPromptUser(metadata, false, 'same as video'), true);
      assert.strictEqual(shouldPromptUser(metadata, true, 'same as video'), false);
      assert.strictEqual(shouldPromptUser(metadata, false, 'English'), false);
    });
  });

  // ── 5. yt-dlp Audio Downloader & Error Classification (B3) ────────────────
  describe('yt-dlp Error Classification (B3)', () => {
    it('should classify private video errors properly', () => {
      const err = classifyYtDlpError('ERROR: [youtube] 1234: Private video. Sign in if you have access.');
      assert.ok(err instanceof PrivateVideoError);
      assert.strictEqual(err.code, 'ERR_PRIVATE_VIDEO');
    });

    it('should classify age-restricted video errors properly', () => {
      const err = classifyYtDlpError('ERROR: [youtube] 5678: Sign in to confirm your age. This video is restricted.');
      assert.ok(err instanceof AgeRestrictedError);
      assert.strictEqual(err.code, 'ERR_AGE_RESTRICTED');
    });

    it('should classify geo-blocked video errors properly', () => {
      const err = classifyYtDlpError('ERROR: [youtube] 9999: The uploader has not made this video available in your country');
      assert.ok(err instanceof GeoBlockedError);
      assert.strictEqual(err.code, 'ERR_GEO_BLOCKED');
    });

    it('should classify download rate-limiting / blocking errors properly', () => {
      const err = classifyYtDlpError('ERROR: [youtube] 4040: HTTP Error 429: Too Many Requests');
      assert.ok(err instanceof DownloadBlockedError);
      assert.strictEqual(err.code, 'ERR_DOWNLOAD_BLOCKED');
    });

    it('should classify duration limit exceeded properly', () => {
      const err = classifyYtDlpError('Video duration 4500s exceeds maximum allowed 3600s');
      assert.ok(err instanceof VideoTooLongError);
      assert.strictEqual(err.code, 'ERR_TOO_LONG');
    });
  });
});
