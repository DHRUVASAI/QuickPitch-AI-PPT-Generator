/**
 * Computes exact Jaccard similarity between two texts based on unique word sets.
 * Jaccard(A, B) = |A ∩ B| / |A ∪ B|
 */
export function computeJaccardWordOverlap(textA: string, textB: string): number {
  const wordsA = new Set(
    (textA || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0)
  );

  const wordsB = new Set(
    (textB || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0)
  );

  if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersectionCount++;
    }
  }

  const unionCount = wordsA.size + wordsB.size - intersectionCount;
  if (unionCount === 0) return 0.0;

  const score = intersectionCount / unionCount;
  return Math.round(score * 10000) / 10000;
}
