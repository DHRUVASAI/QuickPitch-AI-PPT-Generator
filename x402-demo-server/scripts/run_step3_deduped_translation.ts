import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';
import path from 'node:path';
import {
  buildSmallTranslationUnits,
  translateSmallUnits,
  type SmallTranslationUnit,
} from '../core/transcript/chunk-translator.js';
import { verifyQuote, formatVerifiedQuote } from '../core/utils/verify-quote.js';
import { GroqProvider } from '../models/providers/groq.provider.js';
import { UnifiedModelClient } from '../models/unified-client.js';

function computeSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  if (words1.size === 0 || words2.size === 0) return 0.0;
  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }
  const union = new Set([...words1, ...words2]).size;
  return Number((intersection / union).toFixed(3));
}

async function main() {
  console.log('='.repeat(90));
  console.log('ITEM 3: REBUILD TRANSLATION UNITS FROM DEDUPED TEXT & AUDIT');
  console.log('='.repeat(90));

  const dedupedVttPath = path.join(process.cwd(), 'scratch', 'qzAHXO_deduped_vtt.json');
  const lv3Path = path.join(process.cwd(), 'scratch', 'qzAHXO_large_v3_translate.json');
  const oldStep2Path = path.join(process.cwd(), 'scratch', 'qzAHXO_step2_translated.json');
  const outJsonPath = path.join(process.cwd(), 'scratch', 'qzAHXO_step3_deduped_translated.json');

  const dedupedCues = JSON.parse(fs.readFileSync(dedupedVttPath, 'utf-8'));
  const lv3Data = JSON.parse(fs.readFileSync(lv3Path, 'utf-8'));
  const oldStep2Units: SmallTranslationUnit[] = JSON.parse(fs.readFileSync(oldStep2Path, 'utf-8'));

  // 1. Build small units from deduped text (~8-12 caption cues or ~60 words)
  const newUnits = buildSmallTranslationUnits(dedupedCues, 10, 60);
  console.log(`\nGrouped 119 deduped cues into ${newUnits.length} clean translation units.`);

  let translatedUnits: SmallTranslationUnit[];

  // If already translated and saved, we can load or retranslate
  if (fs.existsSync(outJsonPath)) {
    const existing = JSON.parse(fs.readFileSync(outJsonPath, 'utf-8'));
    if (existing.length === newUnits.length) {
      console.log(`Loaded existing ${existing.length} translated units from ${outJsonPath}`);
      translatedUnits = existing;
    } else {
      translatedUnits = await doTranslate(newUnits, outJsonPath);
    }
  } else {
    translatedUnits = await doTranslate(newUnits, outJsonPath);
  }

  // 2. Print ALL unit ratios
  console.log('\n' + '='.repeat(90));
  console.log(`AUDIT: ALL ${translatedUnits.length} UNIT LENGTH RATIOS (0.6 - 1.6 RANGE)`);
  console.log('='.repeat(90));

  console.log('| Unit # | Timestamps      | Src Words | En Words | Ratio | Status      | Result |');
  console.log('|--------|-----------------|-----------|----------|-------|-------------|--------|');

  for (const u of translatedUnits) {
    const srcWords = u.sourceWordCount;
    const transWords = (u.translatedText || '').split(/\s+/).filter(Boolean).length;
    const ratio = srcWords > 0 ? Number((transWords / srcWords).toFixed(2)) : 1.0;
    const inRange = ratio >= 0.6 && ratio <= 1.6;
    const flag = inRange ? 'PASSED' : 'OUT_OF_RANGE';
    console.log(`| ${String(u.unitIndex).padEnd(6)} | ${u.timestamps.padEnd(15)} | ${String(srcWords).padEnd(9)} | ${String(transWords).padEnd(8)} | ${String(ratio).padEnd(5)} | ${flag.padEnd(11)} | ${u.status.toUpperCase()} |`);
  }

  // 3. Print 10 chunks side-by-side with large-v3 output & similarity score
  console.log('\n' + '='.repeat(90));
  console.log('10 CHUNKS SIDE-BY-SIDE: DEDUPED STEP 3 VS LARGE-V3 TRANSLATE');
  console.log('='.repeat(90));

  const sampleCount = Math.min(10, translatedUnits.length);
  for (let i = 0; i < sampleCount; i++) {
    const u = translatedUnits[i];

    // Find large-v3 segments in same time window
    const matchingLv3 = lv3Data.segments.filter((s: any) => {
      return (s.start >= u.startSec - 1.5 && s.start <= u.endSec + 1.5) ||
             (s.end >= u.startSec - 1.5 && s.end <= u.endSec + 1.5) ||
             (s.start <= u.startSec && s.end >= u.endSec);
    });
    const lv3Text = matchingLv3.map((s: any) => s.text).join(' ').trim();
    const sim = computeSimilarity(u.translatedText || '', lv3Text);
    const isLow = sim < 0.25;

    console.log(`\n### CHUNK ${i + 1} [${u.timestamps}]`);
    console.log(`Similarity Score: ${sim} ${isLow ? '[FLAGGED: LOW SIMILARITY]' : '[OK]'}`);
    console.log(`[Step 3 Translation (Deduped)]:`);
    console.log(`"${u.translatedText}"`);
    console.log(`[Large-v3 (task=translate)]:`);
    console.log(`"${lv3Text || '(No segment)'}"`);

    // Verify quote in saved step 3 file
    const v = verifyQuote(outJsonPath, (u.translatedText || '').slice(0, 35));
    console.log(`Verification: ${formatVerifiedQuote(v)}`);
  }

  // 4. Show OLD Unit 7 and NEW Unit 7
  console.log('\n' + '='.repeat(90));
  console.log('COMPARISON: OLD UNIT 7 (ROLLING REPEATS) VS NEW UNIT 7 (DEDUPED)');
  console.log('='.repeat(90));

  const oldU7 = oldStep2Units.find(u => u.unitIndex === 7);
  const newU7 = translatedUnits[Math.min(6, translatedUnits.length - 1)]; // 7th unit (0-indexed 6)

  if (oldU7) {
    console.log('\n[OLD UNIT 7 - From scratch/qzAHXO_step2_translated.json]:');
    console.log(`Timestamps: ${oldU7.timestamps} | Word count: ${oldU7.sourceWordCount} src / ${oldU7.translatedWordCount} en`);
    console.log(`Source Hindi (Repetitive):\n"${oldU7.sourceText}"`);
    console.log(`English Output (Repetitive):\n"${oldU7.translatedText}"`);
    const vOld = verifyQuote(oldStep2Path, oldU7.sourceText.slice(0, 35));
    console.log(`Verification: ${formatVerifiedQuote(vOld)}`);
  }

  if (newU7) {
    console.log('\n[NEW UNIT 7 - From scratch/qzAHXO_step3_deduped_translated.json]:');
    console.log(`Timestamps: ${newU7.timestamps} | Word count: ${newU7.sourceWordCount} src / ${newU7.translatedWordCount} en`);
    console.log(`Source Hindi (Clean Deduped):\n"${newU7.sourceText}"`);
    console.log(`English Output (Clean Non-Overlapping):\n"${newU7.translatedText}"`);
    const vNew = verifyQuote(outJsonPath, newU7.sourceText.slice(0, 35));
    console.log(`Verification: ${formatVerifiedQuote(vNew)}`);
  }
}

async function doTranslate(units: SmallTranslationUnit[], outPath: string): Promise<SmallTranslationUnit[]> {
  console.log(`Translating ${units.length} units with Groq at temperature 0...`);
  const client = new UnifiedModelClient([new GroqProvider()]);
  const translated = await translateSmallUnits(units, client, 'hi');
  fs.writeFileSync(outPath, JSON.stringify(translated, null, 2), 'utf-8');
  console.log(`Saved ${translated.length} units to ${outPath}`);
  return translated;
}

main().catch(console.error);
