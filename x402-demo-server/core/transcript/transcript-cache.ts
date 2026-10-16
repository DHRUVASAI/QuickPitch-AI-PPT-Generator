import fs from 'node:fs';
import path from 'node:path';
import type { TranscriptData } from '../schemas/transcript.schema.js';

const DEFAULT_TTL_MS = parseInt(process.env.TRANSCRIPT_CACHE_TTL_MS || '', 10) || 24 * 60 * 60 * 1000; // 24 hours default

interface CacheRecord {
  data: TranscriptData;
  cachedAt: number;
}

const memoryCache = new Map<string, CacheRecord>();
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

export function getCachedTranscript(key: string, ttlMs: number = DEFAULT_TTL_MS): TranscriptData | null {
  const now = Date.now();

  // 1. Check in-memory cache
  const mem = memoryCache.get(key);
  if (mem) {
    if (now - mem.cachedAt > ttlMs) {
      memoryCache.delete(key);
      deleteCachedTranscript(key);
      return null;
    }
    return mem.data;
  }

  // 2. Check disk cache
  ensureCacheDir();
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);

      let record: CacheRecord;
      if (parsed && typeof parsed.cachedAt === 'number' && parsed.data) {
        record = parsed as CacheRecord;
      } else {
        const stats = fs.statSync(filePath);
        record = { data: parsed as TranscriptData, cachedAt: stats.mtimeMs };
      }

      if (now - record.cachedAt > ttlMs) {
        fs.unlinkSync(filePath);
        memoryCache.delete(key);
        return null;
      }

      memoryCache.set(key, record);
      return record.data;
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

  const record: CacheRecord = { data, cachedAt: Date.now() };
  memoryCache.set(key, record);

  ensureCacheDir();
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn(`[TranscriptCache] Warning: Failed to persist cache to disk: ${err.message}`);
  }
}

export function deleteCachedTranscript(keyOrUrl: string): boolean {
  const vid = extractVideoId(keyOrUrl);
  let removed = false;

  // Evict from memory
  for (const k of Array.from(memoryCache.keys())) {
    if (k === keyOrUrl || k.startsWith(vid)) {
      memoryCache.delete(k);
      removed = true;
    }
  }

  // Evict from disk
  ensureCacheDir();
  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const f of files) {
      if (f === `${keyOrUrl}.json` || f.startsWith(vid)) {
        fs.unlinkSync(path.join(CACHE_DIR, f));
        removed = true;
      }
    }
  } catch {}

  return removed;
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
