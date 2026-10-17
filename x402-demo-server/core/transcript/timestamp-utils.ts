/**
 * Timestamp formatting and slide chunk range utilities.
 * Ensures consistent MM:SS formatting, accurate segment-derived chunk ranges,
 * and strict clamping to video duration.
 */

export interface ChunkTimeRange {
  startSec: number;
  endSec: number;
}

export interface ChunkWithTime extends ChunkTimeRange {
  index: number;
  timestamps: string;
  text: string;
}

export interface SlideSourceRangeResult {
  source_start: number;
  source_end: number;
  source_timestamps: string;
}

/**
 * Formats a numeric duration in seconds into an MM:SS label.
 * Single shared function for all timestamp label production.
 *
 * Examples:
 *   0 -> "00:00"
 *   65.4 -> "01:05"
 *   327.9 -> "05:27"
 */
export function formatMmSs(sec: number): string {
  if (typeof sec !== 'number' || isNaN(sec) || sec <= 0) {
    return '00:00';
  }
  const totalSeconds = Math.floor(sec);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Parses an MM:SS label back to integer seconds.
 */
export function parseMmSs(label: string): number {
  if (!label || typeof label !== 'string') return 0;
  const parts = label.trim().split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

/**
 * Calculates a slide's source_start and source_end from the chunks actually used,
 * clamped to the video duration.
 *
 * source_start = min(chunks.startSec), clamped >= 0
 * source_end   = max(chunks.endSec), clamped <= videoDuration
 * source_timestamps = formatMmSs(source_start) - formatMmSs(source_end)
 */
export function calculateSlideSourceRange(
  chunksUsed: ChunkTimeRange[],
  videoDuration?: number
): SlideSourceRangeResult {
  if (!chunksUsed || chunksUsed.length === 0) {
    const end = videoDuration && videoDuration > 0 ? Number(videoDuration.toFixed(1)) : 0;
    return {
      source_start: 0,
      source_end: end,
      source_timestamps: `00:00 - ${formatMmSs(end)}`,
    };
  }

  const rawMin = Math.min(...chunksUsed.map((c) => c.startSec));
  const rawMax = Math.max(...chunksUsed.map((c) => c.endSec));

  const startClamped = Math.max(0, rawMin);
  let endClamped = Math.max(startClamped, rawMax);

  if (typeof videoDuration === 'number' && videoDuration > 0) {
    endClamped = Math.min(videoDuration, endClamped);
  }

  const source_start = Number(startClamped.toFixed(1));
  const source_end = Number(endClamped.toFixed(1));

  return {
    source_start,
    source_end,
    source_timestamps: `${formatMmSs(source_start)} - ${formatMmSs(source_end)}`,
  };
}

/**
 * Builds distinct chunks from real segment timestamps.
 */
export function buildChunksFromSegments(
  segments: Array<{ start: number; end: number; text: string }>,
  contentSlidesCount: number,
  videoDuration?: number
): ChunkWithTime[] {
  if (!Array.isArray(segments) || segments.length === 0 || contentSlidesCount <= 0) {
    return [];
  }

  const chunks: ChunkWithTime[] = [];
  const segsPerChunk = Math.ceil(segments.length / contentSlidesCount);

  for (let cIdx = 0; cIdx < contentSlidesCount; cIdx++) {
    const slice = segments.slice(cIdx * segsPerChunk, Math.min(segments.length, (cIdx + 1) * segsPerChunk));
    if (slice.length > 0) {
      const rawStart = slice[0].start;
      const rawEnd = slice[slice.length - 1].end;
      const range = calculateSlideSourceRange([{ startSec: rawStart, endSec: rawEnd }], videoDuration);

      chunks.push({
        index: cIdx + 1,
        startSec: range.source_start,
        endSec: range.source_end,
        timestamps: range.source_timestamps,
        text: slice.map((s) => s.text).join(' ').trim(),
      });
    }
  }

  return chunks;
}
