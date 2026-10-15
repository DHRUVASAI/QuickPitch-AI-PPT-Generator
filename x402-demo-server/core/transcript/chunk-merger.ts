export interface TranscriptSegmentWithTime {
  start: number;
  end: number;
  text: string;
}

/**
 * Deduplicates overlapping text between two adjacent text segments
 * Example:
 *   prev: "we are talking about artificial intelligence architecture"
 *   next: "intelligence architecture which helps optimize memory"
 *   overlap: "intelligence architecture" -> stripped from next
 */
export function deduplicateOverlap(prevText: string, nextText: string, maxOverlapWords: number = 8): string {
  const prevWords = prevText.trim().split(/\s+/);
  const nextWords = nextText.trim().split(/\s+/);

  if (prevWords.length === 0 || nextWords.length === 0) return nextText.trim();

  const maxCheck = Math.min(prevWords.length, nextWords.length, maxOverlapWords);

  // Look for longest matching overlap
  for (let len = maxCheck; len >= 2; len--) {
    const prevSuffix = prevWords.slice(-len).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')).join(' ');
    const nextPrefix = nextWords.slice(0, len).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')).join(' ');

    if (prevSuffix.length > 3 && prevSuffix === nextPrefix) {
      return nextWords.slice(len).join(' ');
    }
  }

  return nextText.trim();
}

/**
 * Merges sequentially processed audio chunks into an ordered, deduplicated transcript
 * preserving accurate start and end timestamps.
 */
export function mergeChunkedSegments(
  chunks: Array<{
    chunkOffsetSeconds: number;
    segments: Array<{ start: number; end: number; text: string }>;
  }>
): {
  fullText: string;
  segments: TranscriptSegmentWithTime[];
} {
  const mergedSegments: TranscriptSegmentWithTime[] = [];
  const textPieces: string[] = [];
  let previousText = '';

  for (const chunk of chunks) {
    for (const seg of chunk.segments) {
      const cleanSegText = seg.text.trim();
      if (!cleanSegText) continue;

      const absoluteStart = Math.round((chunk.chunkOffsetSeconds + seg.start) * 100) / 100;
      const absoluteEnd = Math.round((chunk.chunkOffsetSeconds + seg.end) * 100) / 100;

      const deduplicatedText = deduplicateOverlap(previousText, cleanSegText);

      if (deduplicatedText.length > 0) {
        mergedSegments.push({
          start: absoluteStart,
          end: absoluteEnd,
          text: deduplicatedText,
        });
        textPieces.push(deduplicatedText);
        previousText = deduplicatedText;
      }
    }
  }

  return {
    fullText: textPieces.join(' '),
    segments: mergedSegments,
  };
}
