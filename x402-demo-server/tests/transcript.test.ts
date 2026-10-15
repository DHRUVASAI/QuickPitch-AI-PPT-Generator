import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeTranscriptText, cleanTextForPptx } from '../core/transcript/sanitizer.js';
import { validateTranscriptData } from '../core/schemas/transcript.schema.js';
import { extractTranscript } from '../core/transcript/extractor.js';
import type { ITranscriptionProvider } from '../models/types.js';

class MockTranscriptionProvider implements ITranscriptionProvider {
  public readonly name = 'mock-transcribe';
  async isAvailable(): Promise<boolean> {
    return true;
  }
  async transcribeAudio(): Promise<string> {
    return 'Transcribed audio speech text from mock provider.';
  }
}

describe('Core Stage 1: Transcript Ingestion & Sanitization', () => {
  it('should clean and sanitize raw VTT/SRT text', () => {
    const rawVtt = `WEBVTT
Kind: captions
Language: en

00:00:01.000 --> 00:00:04.000
[Music] Welcome back to the channel.

00:00:05.120 --> 00:00:08.500
This is a discussion about artificial intelligence architectures.
Please subscribe to my channel.`;

    const cleaned = sanitizeTranscriptText(rawVtt);

    assert.ok(!cleaned.includes('WEBVTT'));
    assert.ok(!cleaned.includes('00:00:01'));
    assert.ok(!cleaned.includes('[Music]'));
    assert.ok(!cleaned.includes('subscribe to my channel'));
    assert.ok(cleaned.includes('artificial intelligence architectures'));
  });

  it('should clean text for PPTX output', () => {
    const dirty = 'Hello <b>World</b> & Universe! http://example.com/test';
    const cleaned = cleanTextForPptx(dirty, 100);

    assert.ok(!cleaned.includes('<b>'));
    assert.ok(!cleaned.includes('http://'));
    assert.ok(cleaned.includes('and Universe'));
  });

  it('should validate valid TranscriptData schema', () => {
    const validated = validateTranscriptData({
      sourceType: 'text',
      title: 'AI Lecture',
      rawText: 'Full content of the lecture.',
      sanitizedText: 'Full content of the lecture.',
    });

    assert.strictEqual(validated.sourceType, 'text');
    assert.strictEqual(validated.title, 'AI Lecture');
    assert.strictEqual(validated.charCount, 28);
  });

  it('should reject invalid or empty transcript', () => {
    assert.throws(() => {
      validateTranscriptData({
        sourceType: 'text',
        title: 'Empty',
        sanitizedText: '',
      });
    }, /Transcript ValidationError/);
  });

  it('should extract transcript using mocked audio transcription provider', async () => {
    const mockAudioProvider = new MockTranscriptionProvider();
    const result = await extractTranscript({
      sourceType: 'audio',
      audioBuffer: Buffer.from('mock audio bytes'),
      fileName: 'test.mp3',
    }, { transcriptionProvider: mockAudioProvider });

    assert.strictEqual(result.sourceType, 'audio');
    assert.ok(result.sanitizedText.includes('Transcribed audio speech text'));
  });
});
