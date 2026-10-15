import { YoutubeTranscript } from 'youtube-transcript';
import type { ITranscriptionProvider } from '../../models/types.js';
import { type TranscriptData, validateTranscriptData } from '../schemas/transcript.schema.js';
import { sanitizeTranscriptText } from './sanitizer.js';

// Cache transcripts in-memory per URL
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
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const html = await res.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/i) || html.match(/<meta property="og:title" content="(.*?)"/i);
    const descMatch = html.match(/<meta property="og:description" content="(.*?)"/i) || html.match(/<meta name="description" content="(.*?)"/i);
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : '';
    const description = descMatch ? descMatch[1].trim() : '';
    return { title, description };
  } catch {
    return { title: '', description: '' };
  }
}

async function extractYouTube(url: string): Promise<{ title: string; rawText: string; metadata?: any }> {
  const cached = youtubeCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < 1000 * 60 * 60) {
    return {
      title: cached.title,
      rawText: cached.transcript,
      metadata: { url, description: cached.description, fetchedAt: cached.fetchedAt },
    };
  }

  const meta = await fetchYouTubeMetadata(url);
  let transcript = '';

  const fetchWithTimeout = (promise: Promise<any>, timeoutMs: number = 10000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), timeoutMs)),
    ]);
  };

  try {
    const lines: any = await fetchWithTimeout(YoutubeTranscript.fetchTranscript(url, { lang: 'en' }), 10000);
    transcript = lines.map((t: any) => t.text).join(' ');
  } catch {
    try {
      const lines: any = await fetchWithTimeout(YoutubeTranscript.fetchTranscript(url), 10000);
      transcript = lines.map((t: any) => t.text).join(' ');
    } catch {
      transcript = `${meta.title}. ${meta.description}`;
    }
  }

  youtubeCache.set(url, {
    title: meta.title || 'YouTube Video',
    transcript,
    description: meta.description,
    fetchedAt: Date.now(),
  });

  return {
    title: meta.title || 'YouTube Video',
    rawText: transcript,
    metadata: { url, description: meta.description },
  };
}

/**
 * Extracts, normalizes, sanitizes, and validates transcript data from any input modality
 */
export async function extractTranscript(
  input: ExtractTranscriptInput,
  options?: { transcriptionProvider?: ITranscriptionProvider }
): Promise<TranscriptData> {
  const { sourceType, url, text, audioBuffer, fileName, contentType, topicHint } = input;

  let title = topicHint || 'Executive Presentation';
  let rawText = '';
  let metadata: any = undefined;

  if (sourceType === 'youtube') {
    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
      throw new Error('Valid YouTube URL is required');
    }
    const ytData = await extractYouTube(url);
    title = ytData.title || title;
    rawText = ytData.rawText;
    metadata = ytData.metadata;
  } else if (sourceType === 'audio') {
    if (!audioBuffer) {
      if (text) {
        rawText = text;
      } else {
        throw new Error('Audio file buffer is required for audio transcription');
      }
    } else {
      if (!options?.transcriptionProvider) {
        throw new Error('No transcription provider provided for audio transcription');
      }
      rawText = await options.transcriptionProvider.transcribeAudio(
        audioBuffer,
        fileName || 'recording.mp3',
        contentType || 'audio/mpeg'
      );
    }
    title = topicHint || fileName || 'Audio Speech Transcript';
    metadata = { fileName };
  } else {
    // text mode
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
    metadata,
  });
}
