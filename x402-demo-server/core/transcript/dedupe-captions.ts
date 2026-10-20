export interface CaptionCue {
  start: string | number;
  end: string | number;
  text: string;
}

export interface DedupedCue {
  start: string | number;
  end: string | number;
  text: string;
}

/**
 * Collapses rolling auto-captions where sequential cues repeat the previous cue's text
 * into non-overlapping text with the real start time.
 */
export function dedupeRollingCaptions(cues: CaptionCue[]): DedupedCue[] {
  if (!Array.isArray(cues) || cues.length === 0) return [];

  const result: DedupedCue[] = [];
  let prevWords: string[] = [];

  for (const cue of cues) {
    const rawText = (cue.text || '').trim();
    if (!rawText) continue;

    const words = rawText.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    // Find maximal overlap between suffix of prevWords and prefix of current words
    let maxOverlap = 0;
    const checkLen = Math.min(prevWords.length, words.length);

    for (let k = checkLen; k >= 1; k--) {
      const prevSlice = prevWords.slice(prevWords.length - k).join(' ');
      const curSlice = words.slice(0, k).join(' ');
      if (prevSlice === curSlice) {
        maxOverlap = k;
        break;
      }
    }

    const newWords = words.slice(maxOverlap);
    if (newWords.length > 0) {
      result.push({
        start: cue.start,
        end: cue.end,
        text: newWords.join(' '),
      });
      prevWords = words;
    }
  }

  return result;
}
