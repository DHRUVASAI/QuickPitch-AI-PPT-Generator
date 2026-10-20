import fs from 'node:fs';
import path from 'node:path';
import { writeEvidence } from './evidence-helper.js';
import { gradeBulletAgainstSource } from '../core/synthesis/bullet-verifier.js';
import type { ChunkWithTime } from '../core/transcript/timestamp-utils.js';

async function main() {
  const root = path.resolve(__dirname, '../../');
  const serverDir = path.join(root, 'x402-demo-server');

  const deck = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/round38_hindi_deck.json'), 'utf-8'));
  const translatedUnits = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/qzAHXO_step3_deduped_translated.json'), 'utf-8'));
  const whisperData = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/qzAHXO_large_v3_translate.json'), 'utf-8'));
  const whisperRawText = whisperData.segments.map((s: any) => s.text).join(' ');

  // Map each slide (1-8) to the corresponding translated units
  // There are 8 slides and 14 units. Slicing units evenly across 8 slides:
  // Slide 1: Units 1-2 (00:00 - 00:48)
  // Slide 2: Units 3-4 (00:48 - 01:32)
  // Slide 3: Units 5-6 (01:32 - 02:18)
  // Slide 4: Units 7-8 (02:18 - 03:00)
  // Slide 5: Units 9-10 (03:00 - 03:51)
  // Slide 6: Units 11-12 (03:51 - 04:41)
  // Slide 7: Units 13 (04:41 - 05:03)
  // Slide 8: Unit 14 (05:03 - 05:28)

  const slideChunks: Array<ChunkWithTime & { originalText?: string }> = [];
  const unitsPerSlide = Math.ceil(translatedUnits.length / deck.slides.length);

  for (let sIdx = 0; sIdx < deck.slides.length; sIdx++) {
    const startU = sIdx * unitsPerSlide;
    const endU = Math.min(translatedUnits.length, (sIdx + 1) * unitsPerSlide);
    const assignedUnits = translatedUnits.slice(startU, endU === 0 ? translatedUnits.length : endU);
    const actualUnits = assignedUnits.length > 0 ? assignedUnits : [translatedUnits[translatedUnits.length - 1]];

    const startSec = actualUnits[0].startSec;
    const endSec = actualUnits[actualUnits.length - 1].endSec;
    const timestamps = `${actualUnits[0].timestamps.split(' - ')[0]} - ${actualUnits[actualUnits.length - 1].timestamps.split(' - ')[1]}`;
    const originalText = actualUnits.map((u: any) => u.sourceText).join(' ');
    const englishText = actualUnits.map((u: any) => u.translatedText || '').join(' ');

    slideChunks.push({
      index: sIdx + 1,
      startSec,
      endSec,
      timestamps,
      text: englishText,
      originalText,
    });
  }

  let countSupported = 0;
  let countPartial = 0;
  let countNoSupport = 0;

  const auditedBullets: any[] = [];
  const nonSupportedBullets: any[] = [];

  let bulletNumber = 0;
  for (const slide of deck.slides) {
    const chunk = slideChunks[slide.slideIndex - 1] || slideChunks[slideChunks.length - 1];

    for (const card of slide.cards) {
      for (const bulletText of card.points) {
        bulletNumber++;
        const audit = await gradeBulletAgainstSource(bulletText, chunk, undefined, whisperRawText);

        const record = {
          bulletNumber,
          slideIndex: slide.slideIndex,
          bulletText,
          grade: audit.grade,
          isSupported: audit.grade === 'SUPPORTED',
          citedChunkIndex: chunk.index,
          citedChunkTimestamps: chunk.timestamps,
          flaggedTerms: audit.flaggedTerms,
          reason: audit.reason,
        };

        auditedBullets.push(record);

        if (audit.grade === 'SUPPORTED') {
          countSupported++;
        } else if (audit.grade === 'PARTIAL') {
          countPartial++;
          nonSupportedBullets.push(record);
        } else {
          countNoSupport++;
          nonSupportedBullets.push(record);
        }
      }
    }
  }

  const result = writeEvidence(
    'regrade_round38_bullets.json',
    {
      description: 'Re-grading of the original 24 Round 3.8 bullets using the fixed English-vs-Hindi verifier with bilingual matching and Whisper cross-check.',
      totalBulletsAudited: auditedBullets.length,
      gradeCounts: {
        SUPPORTED: countSupported,
        PARTIAL: countPartial,
        NO_SUPPORT: countNoSupport,
      },
      nonSupportedCount: nonSupportedBullets.length,
      nonSupportedBullets,
      allAuditedBullets: auditedBullets,
    },
    [
      'scratch/round38_hindi_deck.json',
      'scratch/qzAHXO_step3_deduped_translated.json',
      'scratch/qzAHXO_large_v3_translate.json',
      'core/synthesis/bullet-verifier.ts',
    ]
  );

  console.log(`Re-grade completed. Written to ${result.relativePath}`);
  console.log(`SUPPORTED: ${countSupported}, PARTIAL: ${countPartial}, NO SUPPORT: ${countNoSupport}`);
}

main().catch(err => {
  console.error('Error re-grading Round 3.8 bullets:', err);
  process.exit(1);
});
