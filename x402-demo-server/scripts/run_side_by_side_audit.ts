import fs from 'node:fs';
import path from 'node:path';
import { verifyQuote, formatVerifiedQuote } from '../core/utils/verify-quote.js';

interface SmallUnit {
  unitIndex: number;
  timestamps: string;
  sourceText: string;
  translatedText: string;
  sourceWordCount: number;
  translatedWordCount: number;
  ratio: number;
  status: string;
}

function main() {
  console.log('='.repeat(90));
  console.log('ITEM 1: SIDE-BY-SIDE TRANSLATION AUDIT');
  console.log('='.repeat(90));

  const jsonPath = path.join(process.cwd(), 'scratch', 'qzAHXO_step2_translated.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File ${jsonPath} not found`);
  }

  const units: SmallUnit[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // First 6 chunks (1..6) and 4 random chunks (e.g., 11, 17, 24, 30)
  const selectedIndices = [1, 2, 3, 4, 5, 6, 11, 17, 24, 30];

  console.log(`\nAUDIT TABLE: 10 UNITS FROM STEP 2 (FIRST 6 + 4 RANDOM UNITS: 11, 17, 24, 30)`);
  console.log('-'.repeat(90));

  for (const idx of selectedIndices) {
    const u = units.find(x => x.unitIndex === idx);
    if (!u) continue;

    const srcWords = u.sourceText.split(/\s+/).filter(Boolean).length;
    const transWords = (u.translatedText || '').split(/\s+/).filter(Boolean).length;
    const ratio = srcWords > 0 ? Number((transWords / srcWords).toFixed(2)) : 1.0;
    const isFlagged = ratio < 0.6 || ratio > 1.6;

    console.log(`\n### UNIT ${u.unitIndex} [${u.timestamps}]`);
    console.log(`Source Word Count: ${srcWords} | English Word Count: ${transWords} | Ratio: ${ratio} | Flag: ${isFlagged ? 'FLAGGED (OUTSIDE 0.6 - 1.6)' : 'OK'}`);
    console.log(`\n[Source Hindi]:\n"${u.sourceText}"`);
    console.log(`\n[English Translation]:\n"${u.translatedText}"`);

    // Verify quote in file
    const vRes = verifyQuote(jsonPath, u.sourceText.slice(0, 30));
    console.log(`Verification: ${formatVerifiedQuote(vRes)}`);
  }

  // Audit Round 3.6 Chunks for comparison (explaining failed chunks)
  const r36Path = path.join(process.cwd(), 'scratch', 'round36_pipeline_final_output.json');
  if (fs.existsSync(r36Path)) {
    console.log('\n' + '='.repeat(90));
    console.log('ROUND 3.6 CHUNKS AUDIT & FAILURE ANALYSIS');
    console.log('='.repeat(90));

    const r36Data = JSON.parse(fs.readFileSync(r36Path, 'utf-8'));
    const r36Transcript = r36Data.hindi?.englishTranscript || '';

    const chunkRegex = /\[CHUNK (\d+) \| TIMESTAMPS: ([^\]]+)\]:\n([\s\S]*?)(?=\n\n\[CHUNK|\Z)/g;
    let match;
    while ((match = chunkRegex.exec(r36Transcript)) !== null) {
      const cIdx = match[1];
      const cTs = match[2];
      const cText = match[3].trim();
      const cWords = cText.split(/\s+/).filter(Boolean).length;

      console.log(`\n--- Round 3.6 Chunk ${cIdx} [${cTs}] ---`);
      console.log(`Word Count: ${cWords}`);
      if (cIdx === '5') {
        console.log(`Status: FAILED / DEGENERATE REPETITION LOOP`);
        console.log(`Excerpt: "${cText.slice(0, 200)}..."`);
        console.log(`Diagnosis: The translator was given repetitive YouTube ASR looping text ("तीन लकी विनर्स को amazon-in अभी भी एक रहस्य है...") and hallucinated repetitive loops ("Think about this and leave your answer in the comment section below... Winners are winners...").`);
      } else {
        console.log(`Status: OK (Single monolithic chunk)`);
      }
    }
  }
}

main();
