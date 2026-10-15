import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const execAsync = promisify(exec);

export class VideoDownloadError extends Error {
  public code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'VideoDownloadError';
    this.code = code;
  }
}

export class PrivateVideoError extends VideoDownloadError {
  constructor(msg: string = 'This YouTube video is private and cannot be accessed.') {
    super(msg, 'ERR_PRIVATE_VIDEO');
  }
}

export class AgeRestrictedError extends VideoDownloadError {
  constructor(msg: string = 'This video is age-restricted and requires YouTube login.') {
    super(msg, 'ERR_AGE_RESTRICTED');
  }
}

export class GeoBlockedError extends VideoDownloadError {
  constructor(msg: string = 'This video is geo-blocked and unavailable in your region.') {
    super(msg, 'ERR_GEO_BLOCKED');
  }
}

export class DownloadBlockedError extends VideoDownloadError {
  constructor(msg: string = 'YouTube blocked the audio download (rate limit or bot challenge).') {
    super(msg, 'ERR_DOWNLOAD_BLOCKED');
  }
}

export class VideoTooLongError extends VideoDownloadError {
  constructor(msg: string = 'Video duration exceeds maximum allowed limit.') {
    super(msg, 'ERR_TOO_LONG');
  }
}

export interface DownloadAudioResult {
  filePath: string;
  title: string;
  durationSeconds: number;
  cleanup: () => Promise<void>;
}

export function classifyYtDlpError(rawError: string): VideoDownloadError {
  const err = rawError.toLowerCase();
  if (err.includes('private video') || err.includes('this video is private')) {
    return new PrivateVideoError();
  }
  if (err.includes('age-restricted') || err.includes('sign in to confirm your age')) {
    return new AgeRestrictedError();
  }
  if (
    err.includes('not available in your country') ||
    err.includes('geo-blocked') ||
    err.includes('blocked in your country') ||
    err.includes('not made this video available')
  ) {
    return new GeoBlockedError();
  }
  if (err.includes('429') || err.includes('too many requests') || err.includes('bot verification') || err.includes('sign in to confirm you')) {
    return new DownloadBlockedError();
  }
  if (err.includes('too long') || err.includes('exceeds maximum') || err.includes('duration exceeds')) {
    return new VideoTooLongError();
  }
  return new VideoDownloadError(`Audio download failed: ${rawError.slice(0, 150)}`, 'ERR_DOWNLOAD_FAILED');
}

function getFfmpegLocation(): string | null {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const wingetDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(wingetDir)) {
      try {
        const pkgs = fs.readdirSync(wingetDir);
        for (const pkg of pkgs) {
          if (pkg.toLowerCase().includes('ffmpeg')) {
            const pkgPath = path.join(wingetDir, pkg);
            const subdirs = fs.readdirSync(pkgPath);
            for (const sub of subdirs) {
              const binCandidate = path.join(pkgPath, sub, 'bin');
              if (fs.existsSync(path.join(binCandidate, 'ffmpeg.exe'))) {
                return binCandidate;
              }
            }
          }
        }
      } catch {}
    }
  }
  return null;
}

/**
 * Downloads audio for caption-less YouTube videos using yt-dlp with duration & size limits
 */
export async function downloadYouTubeAudio(
  url: string,
  options?: {
    maxDurationMinutes?: number;
    maxFileSizeMb?: number;
    tempDir?: string;
  }
): Promise<DownloadAudioResult> {
  const maxDurationSec = (options?.maxDurationMinutes || parseInt(process.env.MAX_VIDEO_DURATION_MINUTES || '60', 10)) * 60;
  const maxFileSizeMb = options?.maxFileSizeMb || parseInt(process.env.MAX_AUDIO_FILE_SIZE_MB || '100', 10);
  const tempDir = options?.tempDir || path.join(os.tmpdir(), 'quickpitch-audio');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 1. Probe video metadata (duration & title) without downloading
  let metadata: any;
  try {
    const { stdout } = await execAsync(`yt-dlp --js-runtimes node --dump-json --no-playlist "${url}"`, {
      timeout: 20000,
      maxBuffer: 10 * 1024 * 1024,
    });
    metadata = JSON.parse(stdout);
  } catch (err: any) {
    const combinedMsg = `${err.stderr || ''} ${err.stdout || ''} ${err.message || ''}`;
    throw classifyYtDlpError(combinedMsg);
  }

  const duration = metadata.duration || 0;
  const title = metadata.title || 'YouTube Audio';

  if (duration > maxDurationSec) {
    const mins = Math.round(duration / 60);
    const limitMins = Math.round(maxDurationSec / 60);
    throw new VideoTooLongError(`Video is ${mins} minutes long, which exceeds the ${limitMins}-minute limit.`);
  }

  // 2. Download audio stream only
  const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const outputPath = path.join(tempDir, `${fileId}.mp3`);

  const cleanup = async () => {
    try {
      if (fs.existsSync(outputPath)) {
        await fs.promises.unlink(outputPath);
      }
    } catch (e: any) {
      console.warn(`[AudioDownloader] Failed to delete temp file ${outputPath}:`, e.message);
    }
  };

  try {
    const ffmpegLoc = getFfmpegLocation();
    const ffmpegOpt = ffmpegLoc ? `--ffmpeg-location "${ffmpegLoc}" ` : '';
    const cmd = `yt-dlp --js-runtimes node ${ffmpegOpt}-f "ba/b" -x --audio-format mp3 --audio-quality 0 --max-filesize ${maxFileSizeMb}M -o "${outputPath}" --no-playlist "${url}"`;
    await execAsync(cmd, {
      timeout: 120000, // 2 minutes max
      maxBuffer: 20 * 1024 * 1024,
    });

    if (!fs.existsSync(outputPath)) {
      throw new VideoDownloadError('Audio file was not created by yt-dlp', 'ERR_FILE_NOT_FOUND');
    }

    return {
      filePath: outputPath,
      title,
      durationSeconds: duration,
      cleanup,
    };
  } catch (err: any) {
    await cleanup();
    if (err instanceof VideoDownloadError) throw err;
    const combinedMsg = `${err.stderr || ''} ${err.stdout || ''} ${err.message || ''}`;
    throw classifyYtDlpError(combinedMsg);
  }
}
