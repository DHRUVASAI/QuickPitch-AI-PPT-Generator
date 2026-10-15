import { YoutubeTranscript } from 'youtube-transcript';
import OpenAI from 'openai';
import type { ITranscriptionProvider } from '../../models/types.js';
import { type TranscriptData, validateTranscriptData } from '../schemas/transcript.schema.js';
import { sanitizeTranscriptText } from './sanitizer.js';
import { withRetryAndTimeout } from '../utils/retry.js';

// In-memory transcript cache per URL
const youtubeCache = new Map<string, { title: string; transcript: string; description: string; fetchedAt: number }>();

export interface ExtractTranscriptInput {
  sourceType: 'youtube' | 'audio' | 'text';
  url?: string;
  text?: string;
  audioBuffer?: Buffer;
  fileName?: string;
  contentType?: string;
  topicHint?: string;
}

export async function fetchYouTubeMetadata(url: string): Promise<{ title: string; description: string }> {
  try {
    return await withRetryAndTimeout(
      async (signal) => {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal,
        });
        const html = await res.text();
        const titleMatch = html.match(/<title>(.*?)<\/title>/i) || html.match(/<meta property="og:title" content="(.*?)"/i);
        const descMatch = html.match(/<meta property="og:description" content="(.*?)"/i) || html.match(/<meta name="description" content="(.*?)"/i);
        const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : '';
        const description = descMatch ? descMatch[1].trim() : '';
        return { title, description };
      },
      { name: 'fetchYouTubeMetadata', timeoutMs: 5000, retries: 1 }
    );
  } catch {
    return { title: '', description: '' };
  }
}

/**
 * Step 1 in Transcript Chain: YouTube Captions
 */
async function tryYouTubeCaptions(url: string): Promise<string | null> {
  // Try English first
  try {
    const lines: any = await withRetryAndTimeout(
      async () => YoutubeTranscript.fetchTranscript(url, { lang: 'en' }),
      { name: 'YouTubeTranscript (en)', timeoutMs: 7000, retries: 1, initialDelayMs: 250 }
    );
    if (lines && lines.length > 0) {
      return lines.map((t: any) => t.text).join(' ');
    }
  } catch {
    // Try auto-detect language
    try {
      const lines: any = await withRetryAndTimeout(
        async () => YoutubeTranscript.fetchTranscript(url),
        { name: 'YouTubeTranscript (auto)', timeoutMs: 7000, retries: 1, initialDelayMs: 250 }
      );
      if (lines && lines.length > 0) {
        return lines.map((t: any) => t.text).join(' ');
      }
    } catch {
      // YouTube captions unavailable
    }
  }
  return null;
}

/**
 * Step 2 in Transcript Chain: Local Whisper (if local transcription service is active)
 */
async function tryLocalWhisper(buffer: Buffer, fileName: string, contentType: string): Promise<string | null> {
  const localWhisperUrl = process.env.LOCAL_WHISPER_URL || 'http://127.0.0.1:8000/v1/audio/transcriptions';
  try {
    return await withRetryAndTimeout(
      async (signal) => {
        const formData = new FormData();
        formData.append('file', new Blob([new Uint8Array(buffer)], { type: contentType }), fileName);
        formData.append('model', 'whisper-1');

        const resp = await fetch(localWhisperUrl, {
          method: 'POST',
          body: formData,
          signal,
        });

        if (resp.ok) {
          const data = await resp.json();
          return data.text || null;
        }
        return null;
      },
      { name: 'Local Whisper', timeoutMs: 4000, retries: 0 }
    );
  } catch {
    return null;
  }
}

/**
 * Step 3 in Transcript Chain: Groq Cloud Whisper
 */
async function tryGroqWhisper(buffer: Buffer, fileName: string, contentType: string): Promise<string | null> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return null;

  try {
    return await withRetryAndTimeout(
      async () => {
        const groqClient = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
        const file = new File([new Uint8Array(buffer)], fileName, { type: contentType });
        const response = await groqClient.audio.transcriptions.create({
          file,
          model: 'whisper-large-v3',
          temperature: 0.0,
          response_format: 'verbose_json',
        });
        const transcript = typeof response === 'string' ? response : (response as any).text || '';
        return transcript.trim().length > 10 ? transcript : null;
      },
      { name: 'Groq Whisper', timeoutMs: 15000, retries: 1, initialDelayMs: 500 }
    );
  } catch (err: any) {
    console.warn('[TranscriptChain] Groq Whisper error:', err.message);
    return null;
  }
}

/**
 * Step 4 in Transcript Chain: AWS Transcribe (via S3)
 */
async function tryAwsTranscribe(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  provider?: ITranscriptionProvider
): Promise<string | null> {
  if (!provider) return null;
  try {
    if (await provider.isAvailable()) {
      return await withRetryAndTimeout(
        async () => provider.transcribeAudio(buffer, fileName, contentType),
        { name: 'AWS Transcribe', timeoutMs: 50000, retries: 1, initialDelayMs: 1000 }
      );
    }
  } catch (err: any) {
    console.warn('[TranscriptChain] AWS Transcribe error:', err.message);
  }
  return null;
}

/**
 * Main Extract Transcript Function implementing the complete fallback chain:
 * 1. YouTube Captions -> 2. Local Whisper -> 3. Groq -> 4. AWS -> 5. Partial Metadata
 */
import fs from 'node:fs';
import { listYouTubeCaptionTracks, evaluateCaptionQuality } from './caption-quality-gate.js';
import { downloadYouTubeAudio, VideoDownloadError } from './audio-downloader.js';
import { gpuLock } from '../utils/gpu-lock.js';
import { getLocalWhisperClient } from '../../models/index.js';

export interface ExtractTranscriptOptions {
  transcriptionProvider?: ITranscriptionProvider;
  allowCloudFallback?: boolean;
  outputLanguage?: string;
}

/**
 * Main Extract Transcript Function implementing the complete fallback chain:
 * 1. YouTube Captions (Quality Gated) -> 2. Audio Download (yt-dlp) + Local Whisper (VAD, GPU-locked) -> 3. Groq -> 4. AWS -> 5. Partial Metadata
 */
export async function extractTranscript(
  input: ExtractTranscriptInput,
  options?: ExtractTranscriptOptions
): Promise<TranscriptData> {
  const { sourceType, url, text, audioBuffer, fileName, contentType, topicHint } = input;

  let title = topicHint || 'Executive Presentation';
  let rawText = '';
  let metadata: any = undefined;
  let isPartial = false;

  if (sourceType === 'youtube') {
    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
      throw new Error('Valid YouTube URL is required');
    }

    const cached = youtubeCache.get(url);
    if (cached && Date.now() - cached.fetchedAt < 1000 * 60 * 60) {
      title = cached.title;
      rawText = cached.transcript;
      metadata = { url, description: cached.description };
    } else {
      const meta = await fetchYouTubeMetadata(url);
      title = meta.title || title;
      metadata = { url, description: meta.description };

      // Step 1: Caption Quality Gate (Check tracks & word count relative to duration)
      console.log(`[TranscriptChain: YouTube] Step 1: Checking caption tracks & quality gate for ${url}...`);
      const trackInfo = await listYouTubeCaptionTracks(url);
      const durationSeconds = trackInfo.durationSeconds;
      if (trackInfo.title && trackInfo.title !== 'YouTube Video') {
        title = trackInfo.title;
      }

      const captions = await tryYouTubeCaptions(url);
      const gateResult = captions ? evaluateCaptionQuality(captions, durationSeconds, {
        isManual: trackInfo.manualTracks.length > 0,
      }) : null;

      if (gateResult && gateResult.isUsable) {
        rawText = captions!;
        console.log(`✓ [TranscriptChain] YouTube captions passed quality gate (${gateResult.wordCount} words, ${gateResult.wordsPerMinute} WPM, manual: ${gateResult.isManual})`);
        metadata = {
          url,
          description: meta.description,
          durationSeconds,
          isManualCaptions: gateResult.isManual,
          language: gateResult.language,
        };
      } else {
        const rejectReason = gateResult ? gateResult.reason : 'No captions track available';
        console.warn(`⚠️ [TranscriptChain] Captions unusable (${rejectReason}). Routing to Audio Download path...`);

        // Step 2: Audio Download & Local Whisper Path (B3 -> B2)
        try {
          console.log(`[TranscriptChain: Audio] Downloading audio stream via yt-dlp for ${url}...`);
          const audioDownload = await downloadYouTubeAudio(url);
          try {
            const dlBuffer = await fs.promises.readFile(audioDownload.filePath);
            const localWhisper = getLocalWhisperClient();

            // Check if local Whisper sidecar is available
            if (await localWhisper.isAvailable()) {
              console.log('[TranscriptChain: LocalWhisper] Acquiring GPU lock for speech transcription...');
              const releaseGpu = await gpuLock.acquire('Whisper-Transcription');

              try {
                // Language detection from first 30 seconds
                console.log('[TranscriptChain: LocalWhisper] Detecting spoken language from first 30s...');
                const detected = await localWhisper.detectLanguage(dlBuffer).catch(() => ({
                  language: 'en',
                  probability: 1.0,
                  duration: durationSeconds,
                }));

                const lowConfidence = detected.probability < 0.60;
                console.log(`[TranscriptChain: LocalWhisper] Detected language: "${detected.language}" (${Math.round(detected.probability * 100)}% confidence, lowConfidence=${lowConfidence})`);

                // For mixed language (e.g. Hindi with English), do not force single language unless confidence is high
                const langToUse = lowConfidence ? undefined : detected.language;

                const detailed = await localWhisper.transcribeAudioDetailed(dlBuffer, 'audio.mp3', 'audio/mpeg', {
                  language: langToUse,
                  vadFilter: true,
                  unloadAfter: true, // Always unload Whisper model from VRAM so Qwen has all 8GB GPU memory
                });

                if (detailed.text && detailed.text.trim().length > 10) {
                  rawText = detailed.text;
                  console.log(`✓ [TranscriptChain: LocalWhisper] Speech transcription succeeded (${rawText.length} chars)`);
                  metadata = {
                    url,
                    description: meta.description,
                    durationSeconds: audioDownload.durationSeconds,
                    language: detailed.language,
                    detectedLanguage: detected.language,
                    languageConfidence: detected.probability,
                    lowLanguageConfidence: lowConfidence,
                  };
                }
              } finally {
                // Guaranteed Whisper model unloading
                await localWhisper.unload().catch(() => {});
                releaseGpu();
              }
            }

            // Fallback to cloud speech if local whisper did not transcribe and cloud fallback is opt-in
            if (!rawText || rawText.trim().length <= 10) {
              const allowCloud = options?.allowCloudFallback ?? (process.env.ALLOW_CLOUD_FALLBACK === 'true');
              if (allowCloud) {
                console.log('[TranscriptChain: Cloud] Trying cloud speech fallback for audio...');
                let cloudText = await tryGroqWhisper(dlBuffer, 'audio.mp3', 'audio/mpeg');
                if (!cloudText) {
                  cloudText = await tryAwsTranscribe(dlBuffer, 'audio.mp3', 'audio/mpeg', options?.transcriptionProvider);
                }
                if (cloudText && cloudText.trim().length > 10) {
                  rawText = cloudText;
                  metadata = {
                    url,
                    description: meta.description,
                    durationSeconds: audioDownload.durationSeconds,
                  };
                }
              }
            }
          } finally {
            // Guaranteed temp file deletion
            await audioDownload.cleanup();
          }
        } catch (audioErr: any) {
          console.warn(`[TranscriptChain] Audio path failed (${audioErr.name || 'Error'}): ${audioErr.message}`);
          isPartial = true;
          rawText = `[Notice: Video transcript was unavailable (${audioErr.message}). Generated using video context & metadata]\n\nVideo Title: ${title}\n\nDescription: ${meta.description || 'Strategic overview of video topic.'}`;
          metadata = {
            url,
            partial: true,
            error: audioErr.message,
            errorCode: audioErr.code || 'ERR_TRANSCRIPT_UNAVAILABLE',
          };
        }
      }

      if (!rawText || rawText.trim().length === 0) {
        isPartial = true;
        rawText = `[Notice: Video transcript was unavailable. Generated using video context & metadata]\n\nVideo Title: ${meta.title || 'YouTube Video'}\n\nDescription: ${meta.description || 'Comprehensive strategic analysis of this video topic.'}`;
      }

      youtubeCache.set(url, {
        title,
        transcript: rawText,
        description: meta.description,
        fetchedAt: Date.now(),
      });
    }
  } else if (sourceType === 'audio') {
    title = topicHint || fileName || 'Audio Speech Transcript';
    metadata = { fileName };

    if (!audioBuffer) {
      if (text && text.trim().length > 0) {
        rawText = text;
      } else {
        throw new Error('Audio file buffer is required for audio transcription');
      }
    } else {
      const fName = fileName || 'recording.mp3';
      const cType = contentType || 'audio/mpeg';
      const allowCloud = options?.allowCloudFallback ?? (process.env.ALLOW_CLOUD_FALLBACK === 'true');

      // Chain 1: Local Whisper
      console.log('[TranscriptChain: Audio] Step 1: Checking Local Whisper...');
      let transcript = await tryLocalWhisper(audioBuffer, fName, cType);

      // Chain 2: Groq Whisper (Opt-in cloud fallback only)
      if (!transcript && allowCloud) {
        console.log('[TranscriptChain: Audio] Step 2: Falling back to Groq Cloud Whisper...');
        transcript = await tryGroqWhisper(audioBuffer, fName, cType);
      }

      // Chain 3: AWS Transcribe / Custom Audio Provider
      const isCloudProvider = options?.transcriptionProvider ? options.transcriptionProvider.isLocal === false : true;
      if (!transcript && (allowCloud || !isCloudProvider)) {
        console.log('[TranscriptChain: Audio] Step 3: Falling back to AWS / Audio Transcribe...');
        transcript = await tryAwsTranscribe(audioBuffer, fName, cType, options?.transcriptionProvider);
      }

      if (transcript && transcript.trim().length > 10) {
        rawText = transcript;
        console.log(`✓ [TranscriptChain] Audio transcription succeeded (${rawText.length} chars)`);
      } else {
        // Fallback: Partial result with clear message
        isPartial = true;
        console.warn('⚠️ [TranscriptChain] All speech providers timed out or failed. Returning partial placeholder text.');
        rawText = `[Notice: Audio transcription timed out across all speech providers]\n\nAudio File: ${fName}\nTopic: ${title}`;
      }
    }
  } else {
    // Text Mode
    rawText = text || '';
    title = topicHint || (rawText.slice(0, 50).trim() || 'Presentation Outline');
  }

  const sanitizedText = sanitizeTranscriptText(rawText);

  return validateTranscriptData({
    sourceType,
    title,
    rawText,
    sanitizedText: sanitizedText.length > 0 ? sanitizedText : rawText,
    charCount: sanitizedText.length > 0 ? sanitizedText.length : rawText.length,
    metadata: {
      ...metadata,
      partial: isPartial,
    },
  });
}
