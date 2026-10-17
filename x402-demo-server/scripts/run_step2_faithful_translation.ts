import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';
import path from 'node:path';
import { getModelClient } from '../models/index.js';
import {
  buildSmallTranslationUnits,
  translateSmallUnits,
  type SmallTranslationUnit
} from '../core/transcript/chunk-translator.js';

async function main() {
  console.log('='.repeat(80));
  console.log('ITEM 2: FAITHFUL SMALL-UNIT TRANSLATION STAGE');
  console.log('='.repeat(80));

  const vttJsonPath = path.join(process.cwd(), 'scratch', 'qzAHXO_parsed_vtt.json');
  if (!fs.existsSync(vttJsonPath)) {
    throw new Error(`Parsed VTT file not found at ${vttJsonPath}`);
  }

  const segments = JSON.parse(fs.readFileSync(vttJsonPath, 'utf-8'));
  console.log(`Loaded ${segments.length} caption segments from ${vttJsonPath}`);

  // Build small units (about 8 to 12 caption lines or ~60 words)
  const units = buildSmallTranslationUnits(segments, 10, 60);
  console.log(`Grouped segments into ${units.length} small translation units.`);

  const { GroqProvider } = await import('../models/providers/groq.provider.js');
  const { UnifiedModelClient } = await import('../models/unified-client.js');
  const client = new UnifiedModelClient([new GroqProvider()]);
  console.log(`Translating ${units.length} units at temperature 0 via Groq (gpt-oss-20b) with line-by-line JSON return and strict ratio/entity checking...`);

  const t0 = Date.now();
  const translatedUnits = await translateSmallUnits(units, client, 'hi');
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\nCompleted translation in ${elapsed}s across ${translatedUnits.length} units.`);

  let translatedCount = 0;
  let untranslatedCount = 0;
  let retriedCount = 0;

  for (const u of translatedUnits) {
    if (u.status === 'translated') translatedCount++;
    else untranslatedCount++;
    if (u.retried) retriedCount++;
  }

  console.log(`Results: ${translatedCount} translated, ${untranslatedCount} untranslated, ${retriedCount} retried.`);

  // Save detailed unit JSON
  const outJsonPath = path.join(process.cwd(), 'scratch', 'qzAHXO_step2_translated.json');
  fs.writeFileSync(outJsonPath, JSON.stringify(translatedUnits, null, 2), 'utf-8');
  console.log(`Saved detailed units to ${outJsonPath}`);

  // Save full regenerated English transcript
  const fullTranscriptLines = translatedUnits.map(u => {
    return `[${u.timestamps}] ${u.translatedText}`;
  });
  const fullTranscriptText = fullTranscriptLines.join('\n\n');

  const outTxtPath = path.join(process.cwd(), 'scratch', 'qzAHXO_step2_english_transcript.txt');
  fs.writeFileSync(outTxtPath, fullTranscriptText, 'utf-8');
  console.log(`Saved full English transcript to ${outTxtPath}`);
}

main().catch(console.error);
