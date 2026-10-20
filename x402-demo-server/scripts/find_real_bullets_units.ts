import fs from 'node:fs';

const units = JSON.parse(fs.readFileSync('scratch/qzAHXO_step3_deduped_translated.json', 'utf-8'));
for (const u of units) {
  console.log(`=== Unit ${u.unitIndex} [${u.timestamps}] ===`);
  console.log('HI:', u.sourceText);
  console.log('EN:', u.translatedText);
}
