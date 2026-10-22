import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface CaptionTrackInfo {
  language: string;
  isManual: boolean;
  name?: string;
  url?: string;
}

export interface CaptionGateResult {
  isUsable: boolean;
  text: string;
  language: string;
  isManual: boolean;
  reason?: string;
  wordCount: number;
  wordsPerMinute: number;
  duplicateRate: number;
}

/**
 * Checks subtitle repetition rate (e.g. loops or repeated filler text)
 */
export function calculateRepetitionRate(lines: string[]): number {
  if (lines.length <= 1) return 0;
  const clean = lines.map((l) => l.trim().toLowerCase()).filter((l) => l.length > 0);
  if (clean.length === 0) return 0;

  const unique = new Set(clean);
  const duplicateCount = clean.length - unique.size;
  return duplicateCount / clean.length;
}

/**
 * Evaluates whether extracted caption text passes the quality gate
 * compared against the video duration in seconds.
 */
export function evaluateCaptionQuality(
  text: string,
  durationSeconds: number,
  options?: {
    isManual?: boolean;
    language?: string;
    detectedAudioLang?: string;
    minWordsPerMinute?: number;
    maxDuplicateRate?: number;
  }
): CaptionGateResult {
  const minWpm = options?.minWordsPerMinute || 35; // typical speech is 120-160 WPM; <35 indicates severe sparsity
  const maxDup = options?.maxDuplicateRate || 0.25; // >25% identical lines indicates glitch/loop

  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  const minutes = Math.max(durationSeconds / 60, 0.2);
  const wordsPerMinute = wordCount / minutes;

  const lines = text.split(/[.\n]/).map((l) => l.trim()).filter((l) => l.length > 0);
  const duplicateRate = calculateRepetitionRate(lines);

  // Check 1: Empty or extremely sparse relative to video duration
  if (wordCount < 15 || wordsPerMinute < minWpm) {
    return {
      isUsable: false,
      text,
      language: options?.language || 'unknown',
      isManual: options?.isManual || false,
      reason: `Captions are too sparse (${wordCount} words for ${Math.round(durationSeconds)}s video, ${Math.round(wordsPerMinute)} WPM, minimum is ${minWpm} WPM)`,
      wordCount,
      wordsPerMinute: Math.round(wordsPerMinute),
      duplicateRate: Math.round(duplicateRate * 100) / 100,
    };
  }

  // Check 2: High proportion of repeated lines
  if (lines.length >= 6 && duplicateRate > maxDup) {
    return {
      isUsable: false,
      text,
      language: options?.language || 'unknown',
      isManual: options?.isManual || false,
      reason: `Captions have an excessive repetition rate (${Math.round(duplicateRate * 100)}% duplicates, maximum allowed is ${Math.round(maxDup * 100)}%)`,
      wordCount,
      wordsPerMinute: Math.round(wordsPerMinute),
      duplicateRate: Math.round(duplicateRate * 100) / 100,
    };
  }

  // Check 3: Language mismatch if audio language was detected
  if (options?.detectedAudioLang && options.language) {
    const audioL = options.detectedAudioLang.toLowerCase().slice(0, 2);
    const capL = options.language.toLowerCase().slice(0, 2);
    if (audioL !== capL && audioL !== 'un' && capL !== 'un') {
      return {
        isUsable: false,
        text,
        language: options.language,
        isManual: options?.isManual || false,
        reason: `Caption language (${options.language}) does not match detected audio language (${options.detectedAudioLang})`,
        wordCount,
        wordsPerMinute: Math.round(wordsPerMinute),
        duplicateRate: Math.round(duplicateRate * 100) / 100,
      };
    }
  }

  return {
    isUsable: true,
    text,
    language: options?.language || 'en',
    isManual: options?.isManual || false,
    wordCount,
    wordsPerMinute: Math.round(wordsPerMinute),
    duplicateRate: Math.round(duplicateRate * 100) / 100,
  };
}

/**
 * Lists available manual and automatic caption tracks for a YouTube URL using yt-dlp
 */
export async function listYouTubeCaptionTracks(url: string): Promise<{
  manualTracks: CaptionTrackInfo[];
  autoTracks: CaptionTrackInfo[];
  durationSeconds: number;
  title: string;
  videoId: string;
}> {
  try {
    const { stdout } = await execAsync(`yt-dlp --extractor-args "youtube:player_client=android,web" --dump-json --no-playlist "${url}"`, {
      timeout: 25000,
      maxBuffer: 15 * 1024 * 1024,
    });
    const info = JSON.parse(stdout);

    const manualTracks: CaptionTrackInfo[] = [];
    if (info.subtitles && typeof info.subtitles === 'object') {
      for (const [lang, tracks] of Object.entries(info.subtitles)) {
        if (Array.isArray(tracks) && tracks.length > 0) {
          manualTracks.push({
            language: lang,
            isManual: true,
            name: tracks[0]?.name,
            url: tracks[0]?.url,
          });
        }
      }
    }

    const autoTracks: CaptionTrackInfo[] = [];
    if (info.automatic_captions && typeof info.automatic_captions === 'object') {
      for (const [lang, tracks] of Object.entries(info.automatic_captions)) {
        if (Array.isArray(tracks) && tracks.length > 0) {
          autoTracks.push({
            language: lang,
            isManual: false,
            name: tracks[0]?.name,
            url: tracks[0]?.url,
          });
        }
      }
    }

    return {
      manualTracks,
      autoTracks,
      durationSeconds: info.duration || 0,
      title: info.title || 'YouTube Video',
      videoId: info.id || '',
    };
  } catch (err: any) {
    return {
      manualTracks: [],
      autoTracks: [],
      durationSeconds: 0,
      title: 'YouTube Video',
      videoId: '',
    };
  }
}
