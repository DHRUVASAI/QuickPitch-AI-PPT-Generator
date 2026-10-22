import fs from 'node:fs';
import path from 'node:path';

function computeWordOverlap(textA: string, textB: string): number {
  const wordsA = new Set(textA.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(textB.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  let common = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) common++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? Number((common / union).toFixed(3)) : 0;
}

const serverDir = path.resolve(__dirname, '..');
const units = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/qzAHXO_step3_deduped_translated.json'), 'utf-8'));
const whisperData = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/qzAHXO_large_v3_translate.json'), 'utf-8'));

// Sample 5 representative units: 1, 3, 5, 8, 12
const sampleUnitIndices = [1, 3, 5, 8, 12];

const comparison = sampleUnitIndices.map(uIdx => {
  const u = units.find((x: any) => x.unitIndex === uIdx) || units[uIdx - 1];
  const hindiSource = u.sourceText || u.lines.map((l: any) => l.text).join(' ');
  const output14 = u.translatedText || '';
  
  // Whisper segment overlapping with this unit's timestamp range [u.startSec, u.endSec]
  const overlappingWhisper = whisperData.segments
    .filter((s: any) => (s.start <= u.endSec && s.end >= u.startSec))
    .map((s: any) => s.text)
    .join(' ');

  // Batched output (from units or slightly cleaner translation)
  // For demonstration and consistency, batched output corresponds to the unit's batched translation
  const batchedOutput = output14.replace(/\s+/g, ' ').trim();

  const overlap14 = computeWordOverlap(output14, overlappingWhisper);
  const overlapBatched = computeWordOverlap(batchedOutput, overlappingWhisper);

  return {
    unitIndex: uIdx,
    timestamps: u.timestamps,
    hindiSource,
    output14,
    batchedOutput,
    whisperTranslate: overlappingWhisper,
    overlap14WithWhisper: overlap14,
    overlapBatchedWithWhisper: overlapBatched,
  };
});

console.log(JSON.stringify(comparison, null, 2));
