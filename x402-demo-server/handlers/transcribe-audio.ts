import type { Context } from 'hono';
import OpenAI from 'openai';
import { getTranscriptionClient } from '../models/index.js';

async function transcribeWithGroqWhisper(
  audioBuffer: ArrayBuffer,
  fileName: string,
  contentType: string
): Promise<string | null> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return null;

  try {
    const groqClient = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const file = new File([audioBuffer], fileName, { type: contentType });
    const response = await groqClient.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      temperature: 0.0,
      response_format: 'verbose_json',
    });

    const transcript = typeof response === 'string' ? response : (response as any).text || '';
    if (transcript && transcript.trim().length > 20) {
      return transcript;
    }
  } catch (e: any) {
    console.warn('[WhisperFallback] Error:', e.message);
  }
  return null;
}

export async function handleTranscribeAudio(c: Context) {
  try {
    console.log('[TranscribeAudio] Audio transcription request received');

    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return c.json({ error: 'No audio file provided. Send audio file as "audio" field.' }, 400);
    }

    const fileName = audioFile.name || 'audio.mp3';
    const mimeType = audioFile.type || 'audio/mpeg';

    const isAudio =
      mimeType.startsWith('audio/') ||
      Boolean(fileName.match(/\.(mp3|mp4|wav|m4a|flac|ogg|webm|aac|amr|opus)$/i));

    if (!isAudio) {
      return c.json({ error: 'File must be an audio file.' }, 400);
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const allowCloudParam = formData.get('allow_cloud_fallback');
    const allowCloudFallback = allowCloudParam === 'true' || process.env.ALLOW_CLOUD_FALLBACK === 'true';

    let transcript: string | null = null;
    let providerUsed = 'unknown';

    // If cloud fallback is disabled, do not invoke cloud providers
    if (!allowCloudFallback) {
      console.warn('[TranscribeAudio] Cloud fallback is disabled (ALLOW_CLOUD_FALLBACK=false). Skipping AWS and Groq.');
      return c.json({
        error: 'Cloud transcription fallback is disabled (ALLOW_CLOUD_FALLBACK=false).',
        hint: 'Enable "Allow Cloud Fallback" in request or env to use AWS/Groq speech transcription.',
      }, 403);
    }

    const awsProvider = getTranscriptionClient();

    // 1. Try AWS Transcribe provider
    if (await awsProvider.isAvailable()) {
      try {
        console.log('[TranscribeAudio] Routing to AWSTranscribeProvider...');
        transcript = await awsProvider.transcribeAudio(buffer, fileName, mimeType);
        if (transcript) providerUsed = 'aws-transcribe';
      } catch (awsErr: any) {
        console.warn('[TranscribeAudio] AWSTranscribeProvider error:', awsErr.message);
      }
    }

    // 2. Fallback to Groq Whisper
    if (!transcript) {
      console.log('[TranscribeAudio] Trying Groq Whisper fallback...');
      transcript = await transcribeWithGroqWhisper(arrayBuffer, fileName, mimeType);
      if (transcript) providerUsed = 'groq-whisper';
    }

    if (transcript && transcript.trim().length > 20) {
      return c.json({
        success: true,
        transcript,
        charCount: transcript.length,
        fileName,
        provider: providerUsed,
      });
    }

    return c.json({
      error: 'Transcription produced insufficient or empty text.',
      hint: 'Ensure AWS credentials or GROQ_API_KEY is configured.',
    }, 422);
  } catch (error: any) {
    console.error('[TranscribeAudio] Error:', error);
    return c.json({ error: error.message || 'Transcription failed' }, 500);
  }
}
