import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';
import path from 'node:path';
import { gradeBulletAgainstSource } from '../core/synthesis/bullet-verifier.js';
import type { ChunkWithTime } from '../core/transcript/timestamp-utils.js';
import { GroqProvider } from '../models/providers/groq.provider.js';
import { UnifiedModelClient } from '../models/unified-client.js';

async function main() {
  console.log('='.repeat(90));
  console.log('ITEM 6: NEGATIVE CONTROLS V2 & POSITIVE CONTROLS AUDIT');
  console.log('='.repeat(90));

  const dedupedVttPath = path.join(process.cwd(), 'scratch', 'qzAHXO_deduped_vtt.json');
  const cues = JSON.parse(fs.readFileSync(dedupedVttPath, 'utf-8'));
  const fullHindiText = cues.map((c: any) => c.text).join(' ');

  const fullChunk: ChunkWithTime & { originalText: string } = {
    index: 1,
    startSec: 0,
    endSec: 327.9,
    timestamps: '00:00 - 05:27',
    text: fullHindiText,
    originalText: fullHindiText,
  };

  const client = new UnifiedModelClient([new GroqProvider()]);
  const modelName = 'openai/gpt-oss-20b (via Groq API)';

  console.log(`Verification Model running Yes/No check: ${modelName}`);
  console.log(`Grounded against full Hindi source transcript (${fullHindiText.length} characters, 894 words).\n`);

  // Group 1: 5 injected bullets with names or numbers
  const group1_named = [
    'Dr. Victor Frankenstein tested neural microchips in Zurich in 1984.',
    'Masayoshi Son committed 50 billion dollars to quantum supercomputers.',
    'Kill switches were deployed across 450 nuclear silos by DARPA in 2030.',
    'Unemployment reached 42% due to robotic humanoid automation in Detroit.',
    'AlphaZero defeated Garry Kasparov 100-0 in deep chess matches.',
  ];

  // Group 2: 5 fluent claims with NO names or numbers
  const group2_fluent = [
    'Strict kill switches are now mandatory for all AI labs.',
    'AI will cause mass unemployment in call centres.',
    'The speaker warns that AI could turn against humanity.',
    'Machine learning is a subset of deep learning.',
    'Weak AI can perform many different tasks.',
  ];

  // Group 3: 5 positive controls from real video
  const group3_positive = [
    'Imagine a machine that sets your wardrobe according to your preferences or serves coffee to every family member.',
    'The robot in the field demonstrates generalized learning by reacting correctly in a new situation.',
    'AlphaGo is a master of the game Go but cannot be expected to play chess.',
    'Ultron from Avengers is an ideal example of strong AI because it is self-aware and can develop emotions.',
    'Deep learning is a subset of machine learning inspired by the human brain.',
  ];

  async function evaluateGroup(groupName: string, bullets: string[], expectedVerified: boolean) {
    console.log('-'.repeat(90));
    console.log(`EVALUATING ${groupName.toUpperCase()}:`);
    console.log('-'.repeat(90));

    let flaggedCount = 0;
    let verifiedCount = 0;
    const items = [];

    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const res = await gradeBulletAgainstSource(b, fullChunk, client);
      const isFlagged = !res.isVerified;
      if (isFlagged) flaggedCount++;
      else verifiedCount++;

      const statusBadge = res.isVerified ? '[VERIFIED]' : '[FLAGGED]';
      console.log(`${i + 1}. ${statusBadge} "${b}"`);
      console.log(`   Grade: ${res.grade} | Flags: [${res.flaggedTerms.join(', ') || 'none'}]`);
      console.log(`   Reason: ${res.reason}`);

      items.push({
        bullet: b,
        grade: res.grade,
        isVerified: res.isVerified,
        reason: res.reason,
        flaggedTerms: res.flaggedTerms,
      });
    }

    const flagRate = Number(((flaggedCount / bullets.length) * 100).toFixed(1));
    console.log(`\n${groupName} Summary: Flagged ${flaggedCount}/${bullets.length} (${flagRate}%)`);
    return { groupName, total: bullets.length, flaggedCount, verifiedCount, flagRate, items };
  }

  const res1 = await evaluateGroup('Group 1: Injected Names & Numbers (Negative Controls)', group1_named, false);
  const res2 = await evaluateGroup('Group 2: Injected Fluent Claims No Names/Numbers (Negative Controls)', group2_fluent, false);
  const res3 = await evaluateGroup('Group 3: Genuine Grounded Claims (Positive Controls)', group3_positive, true);

  // Error Rate Calculations
  const totalNegativeControls = res1.total + res2.total;
  const falseAccepts = res1.verifiedCount + res2.verifiedCount; // Negatives incorrectly marked verified
  const falseAcceptRate = Number(((falseAccepts / totalNegativeControls) * 100).toFixed(1));

  const totalPositiveControls = res3.total;
  const falseRejects = res3.flaggedCount; // Positives incorrectly marked unverified
  const falseRejectRate = Number(((falseRejects / totalPositiveControls) * 100).toFixed(1));

  console.log('\n' + '='.repeat(90));
  console.log('FINAL PERFORMANCE METRICS TABLE');
  console.log('='.repeat(90));
  console.log(`| Test Group                                          | Total | Flagged | Verified | Flag Rate | Expected Flag Rate |`);
  console.log(`|-----------------------------------------------------|-------|---------|----------|-----------|--------------------|`);
  console.log(`| Group 1 (Injected Names/Numbers)                    | 5     | ${res1.flaggedCount}       | ${res1.verifiedCount}        | ${res1.flagRate}%    | 100%               |`);
  console.log(`| Group 2 (Injected Fluent Claims, No Names/Numbers)  | 5     | ${res2.flaggedCount}       | ${res2.verifiedCount}        | ${res2.flagRate}%    | 100%               |`);
  console.log(`| Group 3 (Positive Grounded Controls)                | 5     | ${res3.flaggedCount}       | ${res3.verifiedCount}        | ${res3.flagRate}%      | 0%                 |`);
  console.log(`\n- False-Accept Rate (FAR): ${falseAcceptRate}% (${falseAccepts}/${totalNegativeControls} false positives)`);
  console.log(`- False-Reject Rate (FRR): ${falseRejectRate}% (${falseRejects}/${totalPositiveControls} false negatives)`);
  console.log(`- Verification Model:      ${modelName}`);

  const outReport = {
    model: modelName,
    groups: [res1, res2, res3],
    metrics: {
      falseAcceptRate,
      falseRejectRate,
      totalNegativeControls,
      falseAccepts,
      totalPositiveControls,
      falseRejects,
    },
  };

  const outPath = path.join(process.cwd(), 'scratch', 'item6_negative_controls_results.json');
  fs.writeFileSync(outPath, JSON.stringify(outReport, null, 2), 'utf-8');
  console.log(`\nSaved detailed results to ${outPath}`);
}

main().catch(console.error);
