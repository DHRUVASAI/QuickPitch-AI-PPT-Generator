import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { dedupeRollingCaptions } from '../core/transcript/dedupe-captions.js';

describe('Item 2: Dedupe Rolling Auto-Captions Tests', () => {
  it('should collapse rolling cues that repeat previous cues using first 8 cues of qzAHXO_parsed_vtt.json', () => {
    const vttJsonPath = path.join(process.cwd(), 'scratch', 'qzAHXO_parsed_vtt.json');
    assert.ok(fs.existsSync(vttJsonPath), 'scratch/qzAHXO_parsed_vtt.json must exist');

    const allCues = JSON.parse(fs.readFileSync(vttJsonPath, 'utf-8'));
    const first8Cues = allCues.slice(0, 8);

    const deduped = dedupeRollingCaptions(first8Cues);

    // Verify raw word count vs deduped word count
    const rawWords = first8Cues.map((c: any) => c.text).join(' ').split(/\s+/).filter(Boolean);
    const dedupedWords = deduped.map(c => c.text).join(' ').split(/\s+/).filter(Boolean);

    console.log(`[Test] First 8 cues - Raw words: ${rawWords.length}, Deduped words: ${dedupedWords.length}`);
    assert.ok(rawWords.length > dedupedWords.length, 'Raw words must exceed deduped words due to repetitions');
    assert.strictEqual(dedupedWords.length, 44, 'First 8 cues should produce exactly 44 deduped words');

    // Verify non-overlapping phrases
    const fullDedupedText = deduped.map(c => c.text).join(' ');
    assert.ok(fullDedupedText.startsWith('सोचिए कि कोई मशीन है जो आपके हिसाब से आपकी अलमारी सेट कर दे'));
    assert.ok(fullDedupedText.includes('हर मेंबर को उनकी पसंद के हिसाब से कॉफी'));
    assert.ok(fullDedupedText.includes('सर्व कर दे बेसिकली आपका हर दिन आसान बना दे है ना यह है आर्टिफिशियल इंटेलिजेंस के'));

    // Verify no consecutive repeated words
    const tokens = fullDedupedText.split(/\s+/);
    for (let i = 0; i < tokens.length - 2; i++) {
      const phrase = `${tokens[i]} ${tokens[i + 1]}`;
      const nextPhrase = `${tokens[i + 2]} ${tokens[i + 3] || ''}`;
      // Should not have direct duplicate repetitions like "आपकी अलमारी आपकी अलमारी"
      assert.notStrictEqual(phrase, nextPhrase, `Unexpected duplicate phrase: "${phrase}"`);
    }
  });

  it('should dedupe the entire transcript and collapse ~2669 words down to ~900 words', () => {
    const vttJsonPath = path.join(process.cwd(), 'scratch', 'qzAHXO_parsed_vtt.json');
    const allCues = JSON.parse(fs.readFileSync(vttJsonPath, 'utf-8'));
    const deduped = dedupeRollingCaptions(allCues);

    const rawWords = allCues.map((c: any) => c.text).join(' ').split(/\s+/).filter(Boolean).length;
    const dedupedWords = deduped.map(c => c.text).join(' ').split(/\s+/).filter(Boolean).length;

    console.log(`[Test] Full video - Raw words: ${rawWords}, Deduped words: ${dedupedWords}`);
    assert.strictEqual(rawWords, 2669);
    assert.ok(dedupedWords >= 850 && dedupedWords <= 950, `Expected ~900 words, got ${dedupedWords}`);
  });
});
