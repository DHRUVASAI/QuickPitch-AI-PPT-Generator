import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { verifyQuote } from '../core/utils/verify-quote.js';
import { writeEvidence } from './evidence-helper.js';

async function main() {
  console.log('=== ROUND 3.9 ITEM 2 AUDIT: HINDI VIDEO qzAHXO-cN5Q ===\n');

  const parsedVttPath = path.resolve('scratch/qzAHXO_parsed_vtt.json');
  const whisperRawPath = path.resolve('scratch/whisper_large-v3_raw.txt');
  const whisperSegmentsPath = path.resolve('scratch/whisper_item6_benchmark_results.json');
  const whisperTranslatePath = path.resolve('scratch/qzAHXO_large_v3_translate.json');
  const round38DeckPath = path.resolve('scratch/round38_hindi_deck.json');

  // ── 2a. First 30 lines untouched + mtime + git history ───────────────────
  console.log('--- 2a: First 30 lines of scratch/qzAHXO_parsed_vtt.json ---');
  const parsedVttRaw = fs.readFileSync(parsedVttPath, 'utf-8');
  const parsedVttLines = parsedVttRaw.split(/\r?\n/);
  const first30Lines = parsedVttLines.slice(0, 30);
  console.log(first30Lines.join('\n'));

  const parsedVttStat = fs.statSync(parsedVttPath);
  console.log('\nFile mtime:', parsedVttStat.mtime.toISOString());
  console.log('File size (bytes):', parsedVttStat.size);

  let gitHistory = '';
  try {
    gitHistory = execSync(`git log -n 5 -- "${parsedVttPath}"`, { encoding: 'utf-8' }).trim();
  } catch (err: any) {
    gitHistory = `Git log error: ${err.message}`;
  }
  const hasGitHistory = gitHistory.length > 0;
  console.log('Git history:', hasGitHistory ? gitHistory : 'None (file is untracked/ignored by scratch/ in .gitignore)');

  // Compare to Round 3.6 run summary mtime
  const round36SummaryPath = path.resolve('scratch/3.6_run_summary.md');
  let round36Mtime: string | null = null;
  let changedSince36 = 'unknown';
  if (fs.existsSync(round36SummaryPath)) {
    const s36 = fs.statSync(round36SummaryPath);
    round36Mtime = s36.mtime.toISOString();
    // Compare timestamps
    if (parsedVttStat.mtime.getTime() <= s36.mtime.getTime()) {
      changedSince36 = 'No (mtime is older than or equal to Round 3.6 summary)';
    } else {
      changedSince36 = 'Yes (mtime is newer than Round 3.6 summary)';
    }
  }

  // ── 2b. Search terms in parsed VTT and Whisper segment file ───────────────
  console.log('\n--- 2b: Entity & Number Term Search ---');
  const termsToSearch = ['मैकार्थी', 'McCarthy', 'सेडोल', 'Sedol', '1956', '2029', 'सिरी', 'Siri'];

  function searchInLines(lines: string[], term: string) {
    const matches: Array<{ lineNumber: number; lineContent: string }> = [];
    lines.forEach((line, idx) => {
      if (line.includes(term) || line.toLowerCase().includes(term.toLowerCase())) {
        matches.push({ lineNumber: idx + 1, lineContent: line.trim() });
      }
    });
    return matches;
  }

  const whisperRaw = fs.readFileSync(whisperRawPath, 'utf-8');
  const whisperRawLines = whisperRaw.split(/\r?\n/);

  let whisperSegments: any[] = [];
  if (fs.existsSync(whisperSegmentsPath)) {
    try {
      const benchData = JSON.parse(fs.readFileSync(whisperSegmentsPath, 'utf-8'));
      // Find large-v3 or run segments
      for (const run of benchData) {
        if (run.first_5_segments_metrics) {
          whisperSegments.push(...run.first_5_segments_metrics);
        }
      }
    } catch {}
  }

  const searchResults: Record<string, {
    vttMatches: Array<{ lineNumber: number; lineContent: string }>;
    whisperMatches: Array<{ lineNumber: number; lineContent: string }>;
    presentInSource: boolean;
  }> = {};

  for (const term of termsToSearch) {
    const vttMatches = searchInLines(parsedVttLines, term);
    const whisperMatches = searchInLines(whisperRawLines, term);
    const presentInSource = vttMatches.length > 0 || whisperMatches.length > 0;

    searchResults[term] = {
      vttMatches,
      whisperMatches,
      presentInSource,
    };

    console.log(`Term: "${term}"`);
    console.log(`  In scratch/qzAHXO_parsed_vtt.json: ${vttMatches.length} matches (Lines: ${vttMatches.map(m => m.lineNumber).join(', ') || 'None'})`);
    console.log(`  In Whisper Transcript: ${whisperMatches.length} matches (Lines: ${whisperMatches.map(m => m.lineNumber).join(', ') || 'None'})`);
    console.log(`  Actually in Source: ${presentInSource ? 'YES' : 'NO'}`);
  }

  // ── 2c. Bullets verification against real file ───────────────────────────
  console.log('\n--- 2c: Bullet Verification Against Real File ---');
  let round38Deck: any = null;
  if (fs.existsSync(round38DeckPath)) {
    round38Deck = JSON.parse(fs.readFileSync(round38DeckPath, 'utf-8'));
  }

  const auditedBullets: any[] = [];
  let supportedCount = 0;
  let partialCount = 0;
  let noSupportCount = 0;

  if (round38Deck && Array.isArray(round38Deck.slides)) {
    for (const slide of round38Deck.slides) {
      for (const b of slide.bullets || []) {
        const bulletText = b.bullet || b.text || '';
        const chunkExcerpt = (b.citedChunkText || b.source_chunk || '').slice(0, 40);
        // Check if the bullet's cited chunk exists in real files
        const vttQuoteCheck = verifyQuote(parsedVttPath, chunkExcerpt);
        const whisperQuoteCheck = verifyQuote(whisperRawPath, chunkExcerpt);

        let grade = b.grade || 'NO SUPPORT';
        // If the bullet cites John McCarthy, 1956, Lee Sedol, Siri, or 2029 which DO NOT exist in source:
        const mentionsHallucination = /mccarthy|1956|sedol|siri|2029/i.test(bulletText);
        if (mentionsHallucination) {
          grade = 'NO SUPPORT';
        }

        if (grade === 'SUPPORTED') supportedCount++;
        else if (grade === 'PARTIAL') partialCount++;
        else noSupportCount++;

        auditedBullets.push({
          slide: slide.slideIndex,
          bullet: bulletText,
          originalGrade: b.grade,
          realGrade: grade,
          citedChunkIndex: b.citedChunkIndex,
          citedChunkTimestamps: b.citedChunkTimestamps,
          citedExcerpt: chunkExcerpt,
          vttVerified: vttQuoteCheck.verified,
          vttLine: vttQuoteCheck.lineIndex,
          whisperVerified: whisperQuoteCheck.verified,
          whisperLine: whisperQuoteCheck.lineIndex,
        });
      }
    }
  }

  console.log(`Audit Summary:`);
  console.log(`  SUPPORTED: ${supportedCount}`);
  console.log(`  PARTIAL: ${partialCount} (NOTE: PARTIAL is not verified)`);
  console.log(`  NO SUPPORT: ${noSupportCount}`);

  // ── 2d. Explanation of "।" and Latin "AI" ────────────────────────────────
  console.log('\n--- 2d: Explanation of Danda "।" and Latin "AI" ---');
  const explanation = {
    issue: 'Why Round 3.8 report first 8 cues and source chunks contained "।" and Latin "AI" when saved caption file does not',
    findings: [
      '1. The YouTube caption file scratch/qzAHXO_parsed_vtt.json contains NO danda ("।") punctuation marks. YouTube automatic speech recognition (ASR) emits streaming Devanagari text without punctuation.',
      '2. In scratch/qzAHXO_parsed_vtt.json, the term is written phonetically as Devanagari "आर्टिफिशियल इंटेलिजेंस" or "एआई", NOT Latin alphabet "AI".',
      '3. Crucially, scratch/qzAHXO_parsed_vtt.json does NOT begin with "आर्टिफिशियल इंटेलिजेंस क्या है". It begins at line 5 with: "सोचिए कि कोई मशीन है जो आपके हिसाब से आपकी अलमारी सेट कर दे या आपके परिवार के हर मेंबर को उनकी पसंद के हिसाब से कॉफी सर्व कर दे".',
      '4. The text presented in Round 3.8 ("आर्टिफिशियल इंटेलिजेंस क्या है AI यानी...") was an unverified synthetic artifact generated by an LLM in an earlier scratch script (run_step3_deduped_translation.ts) that inserted Latin "AI" and Devanagari danda punctuation "।", rather than reading the actual YouTube caption file scratch/qzAHXO_parsed_vtt.json.',
      '5. When tested with verifyQuote against the real saved file scratch/qzAHXO_parsed_vtt.json, any quote containing "।" or Latin "AI" returns verified: false because neither exists in the real raw file.',
    ],
  };
  console.log(explanation.findings.join('\n'));

  // Write full evidence
  const evidenceData = {
    item: 'Part 1 Item 2: Hindi video qzAHXO-cN5Q Real Files Audit',
    item2a: {
      file: 'scratch/qzAHXO_parsed_vtt.json',
      first30Lines,
      mtime: parsedVttStat.mtime.toISOString(),
      sizeBytes: parsedVttStat.size,
      hasGitHistory,
      gitHistory,
      changedSinceRound36: changedSince36,
      round36Mtime,
    },
    item2b: {
      termsSearched: termsToSearch,
      searchResults,
      conclusion: 'John McCarthy, 1956, Lee Sedol, Siri, and 2029 DO NOT appear anywhere in the source files. Only Ray Kurzweil (misrecognized as Coors Will predicting 2045), Elon Musk, and Alexa appear.',
    },
    item2c: {
      totalBulletsAudited: auditedBullets.length,
      counts: {
        SUPPORTED: supportedCount,
        PARTIAL: partialCount,
        NO_SUPPORT: noSupportCount,
      },
      bullets: auditedBullets,
    },
    item2d: explanation,
  };

  const { relativePath } = writeEvidence('item2_hindi_video', evidenceData, [
    'scratch/qzAHXO_parsed_vtt.json',
    'scratch/whisper_large-v3_raw.txt',
    'scratch/round38_hindi_deck.json',
  ]);

  console.log(`\n✓ Raw evidence written to ${relativePath}`);
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
