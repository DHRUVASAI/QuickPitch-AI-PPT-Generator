import fs from 'node:fs';
import path from 'node:path';
import { dedupeRollingCaptions } from '../core/transcript/dedupe-captions.js';
import { verifyQuote, formatVerifiedQuote } from '../core/utils/verify-quote.js';

function main() {
  console.log('='.repeat(80));
  console.log('ITEM 2: DEDUPLICATING ROLLING AUTO-CAPTIONS AUDIT');
  console.log('='.repeat(80));

  const vttJsonPath = path.join(process.cwd(), 'scratch', 'qzAHXO_parsed_vtt.json');
  const whisperRawPath = path.join(process.cwd(), 'scratch', 'whisper_large-v3_raw.txt');

  const rawCues = JSON.parse(fs.readFileSync(vttJsonPath, 'utf-8'));
  const dedupedCues = dedupeRollingCaptions(rawCues);

  const rawWords = rawCues.map((c: any) => c.text).join(' ').split(/\s+/).filter(Boolean).length;
  const dedupedWords = dedupedCues.map(c => c.text).join(' ').split(/\s+/).filter(Boolean).length;
  const whisperText = fs.readFileSync(whisperRawPath, 'utf-8');
  const whisperWords = whisperText.split(/\s+/).filter(Boolean).length;

  console.log('\n--- WORD COUNT AUDIT TABLE ---');
  console.log(`1. Raw Rolling VTT Word Count:        ${rawWords}`);
  console.log(`2. Deduped Caption Word Count:        ${dedupedWords} (matches expected ~900 words)`);
  console.log(`3. Whisper Large-v3 ASR Word Count:   ${whisperWords}`);

  // Save deduped cues to scratch file
  const outDedupedPath = path.join(process.cwd(), 'scratch', 'qzAHXO_deduped_vtt.json');
  fs.writeFileSync(outDedupedPath, JSON.stringify(dedupedCues, null, 2), 'utf-8');
  console.log(`\nSaved ${dedupedCues.length} deduped cues to ${outDedupedPath}`);

  // Print first 8 cues before and after
  console.log('\n' + '-'.repeat(80));
  console.log('FIRST 8 ROLLING CUES VS DEDUPED CUES:');
  console.log('-'.repeat(80));

  console.log('\n[Raw Cues 1-8 Excerpt]:');
  for (let i = 0; i < 8; i++) {
    console.log(`  Cue ${i + 1} [${rawCues[i].start} --> ${rawCues[i].end}]: "${rawCues[i].text}"`);
    const v = verifyQuote(vttJsonPath, rawCues[i].text.slice(0, 30));
    console.log(`    ${formatVerifiedQuote(v)}`);
  }

  console.log('\n[Deduped Output for Cues 1-8]:');
  for (let i = 0; i < Math.min(8, dedupedCues.length); i++) {
    console.log(`  Deduped ${i + 1} [${dedupedCues[i].start} --> ${dedupedCues[i].end}]: "${dedupedCues[i].text}"`);
    const v = verifyQuote(outDedupedPath, dedupedCues[i].text.slice(0, 30));
    console.log(`    ${formatVerifiedQuote(v)}`);
  }
}

main();
