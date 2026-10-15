import fs from 'node:fs';
import path from 'node:path';
import type { TranscriptData } from '../schemas/transcript.schema.js';

const memoryCache = new Map<string, { data: TranscriptData; cachedAt: number }>();

const CACHE_DIR = path.join(process.cwd(), '.cache', 'transcripts');

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    } catch {}
  }
}

export function extractVideoId(urlOrId: string): string {
  if (!urlOrId) return 'unknown';
  const match = urlOrId.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  return urlOrId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
}

export function buildCacheKey(urlOrId: string, spokenLanguage?: string, forceAudio?: boolean): string {
  const vid = extractVideoId(urlOrId);
  const lang = (spokenLanguage || 'auto').toLowerCase().trim();
  const mode = forceAudio ? 'audio' : 'auto';
  return `${vid}_${lang}_${mode}`;
}

export function getCachedTranscript(key: string): TranscriptData | null {
  // 1. Check in-memory cache
  const mem = memoryCache.get(key);
  if (mem) {
    return mem.data;
  }

  // 2. Check disk cache
  ensureCacheDir();
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw) as TranscriptData;
      memoryCache.set(key, { data, cachedAt: Date.now() });
      return data;
    } catch {
      return null;
    }
  }

  return null;
}

export function setCachedTranscript(key: string, data: TranscriptData): void {
  // Do not cache partial failure placeholders
  if (data.metadata?.partial && !data.sanitizedText) {
    return;
  }

  memoryCache.set(key, { data, cachedAt: Date.now() });

  ensureCacheDir();
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn(`[TranscriptCache] Warning: Failed to persist cache to disk: ${err.message}`);
  }
}

export function clearTranscriptCache(): void {
  memoryCache.clear();
  ensureCacheDir();
  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const f of files) {
      if (f.endsWith('.json')) {
        fs.unlinkSync(path.join(CACHE_DIR, f));
      }
    }
  } catch {}
}
