import fs from 'node:fs';
import path from 'node:path';
import { verifyQuote, formatVerifiedQuote } from '../core/utils/verify-quote.js';
import { clearTranscriptCache, TRANSLATOR_VERSION } from '../core/transcript/transcript-cache.js';

function main() {
  console.log('='.repeat(90));
  console.log('ITEM 7: ROUND 3.6 CHUNK 5 AUDIT & TRANSLATION CACHE VERSIONING');
  console.log('='.repeat(90));

  const r36JsonPath = path.join(process.cwd(), 'scratch', 'round36_pipeline_final_output.json');
  const r36Data = JSON.parse(fs.readFileSync(r36JsonPath, 'utf-8'));

  // Extract Chunk 5 from Round 3.6 englishTranscript
  const transcriptText: string = r36Data.hindi?.englishTranscript || '';
  const chunk5Header = '[CHUNK 5 | TIMESTAMPS: 04:12 - 05:27 (252.9s to 327.9s)]:';
  const c5Start = transcriptText.indexOf(chunk5Header);

  if (c5Start === -1) {
    throw new Error('Chunk 5 header not found in round36_pipeline_final_output.json');
  }

  const chunk5Block = transcriptText.slice(c5Start + chunk5Header.length).trim();
  const chunk5Excerpt = chunk5Block.slice(0, 400);

  console.log(`\n--- SAVED ROUND 3.6 CHUNK 5 DETAILS ---`);
  console.log(`Timestamps: 04:12 - 05:27 (252.9s to 327.9s)`);
  console.log(`Word Count: ${chunk5Block.split(/\s+/).filter(Boolean).length} words\n`);

  console.log(`[Round 3.6 Chunk 5 Output (Degenerate Repetition Loop)]:\n"${chunk5Excerpt}..."\n`);

  // Verify quote with verifyQuote
  const vOutput = verifyQuote(r36JsonPath, chunk5Block.slice(0, 35));
  console.log(`Output Substring Verification: ${formatVerifiedQuote(vOutput)}`);

  // Source input given to the translator in Round 3.6:
  // In Round 3.6, the raw un-deduped YouTube rolling VTT subtitles were chunked into large 60-75s blocks.
  // The corresponding Hindi text had rolling duplicates:
  const rawVttPath = path.join(process.cwd(), 'scratch', 'qzAHXO_parsed_vtt.json');
  const rawCues = JSON.parse(fs.readFileSync(rawVttPath, 'utf-8'));
  const c5RawCues = rawCues.filter((c: any) => {
    const parseSec = (t: string) => {
      const [hh, mm, ss] = t.split(':');
      return parseFloat(hh) * 3600 + parseFloat(mm) * 60 + parseFloat(ss);
    };
    const s = parseSec(c.start);
    return s >= 252.9 && s <= 327.9;
  });
  const c5RawHindi = c5RawCues.map((c: any) => c.text).join(' ');

  console.log(`\n[Round 3.6 Chunk 5 Raw Input Given to Translator (Rolling Repetitions)]:\n"${c5RawHindi.slice(0, 300)}..."\n`);
  const vInput = verifyQuote(rawVttPath, c5RawCues[0].text.slice(0, 30));
  console.log(`Input Substring Verification: ${formatVerifiedQuote(vInput)}`);

  console.log('\n' + '='.repeat(90));
  console.log('CODE PATH & CACHE VERSIONING DIAGNOSIS');
  console.log('='.repeat(90));
  console.log(`1. Did the 3.6 transcript come from the code path the app uses now?
   ANSWER: NO.
   - In Round 3.6, the application fed raw, rolling, non-deduped YouTube ASR cues
     in 60-75 second monolithic blocks directly into the LLM. The repeating cues
     induced degenerative hallucination loops.
   - The app NOW uses:
     a) \`dedupeRollingCaptions\` to collapse repetitive cues to clean, non-overlapping text.
     b) \`buildSmallTranslationUnits\` into 8-12 caption lines / ~60 words.
     c) Temperature 0 faithful translation with line-by-line JSON return and entity checking.

2. Does the cache key include a translator version?
   ANSWER: PREVIOUSLY NO, NOW YES.
   - Previously, \`buildCacheKey\` generated \`\${vid}_\${lang}_\${mode}\` without any version identifier.
     This caused old stale translations from Round 3.6 to persist and be served.
   - Now updated in \`core/transcript/transcript-cache.ts\` to:
     \`\${vid}_\${lang}_\${mode}_\${TRANSLATOR_VERSION}\` (current version: "${TRANSLATOR_VERSION}").

3. Purging stale translations:`);

  // Purge stale translations from cache
  const cacheDir = path.join(process.cwd(), '.cache', 'transcripts');
  if (fs.existsSync(cacheDir)) {
    const files = fs.readdirSync(cacheDir);
    let purged = 0;
    for (const f of files) {
      fs.unlinkSync(path.join(cacheDir, f));
      purged++;
    }
    console.log(`   Purged ${purged} stale translation/transcript cache files from ${cacheDir}.`);
  } else {
    console.log(`   Cache directory ${cacheDir} is clean.`);
  }
}

main();
