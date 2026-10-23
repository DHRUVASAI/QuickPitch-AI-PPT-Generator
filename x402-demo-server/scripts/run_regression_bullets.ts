import fs from 'fs';
import path from 'path';
import { gradeBulletAgainstSource } from '../core/synthesis/bullet-verifier.js';
import { getModelClient } from '../models/index.js';

const repoRoot = path.resolve(__dirname, '../..');

async function main() {
  console.log('=== RUNNING REGRESSION TESTS ON FALSE ACCEPTS ===');

  const deckPath = path.join(__dirname, '../scratch/round38_hindi_deck.json');
  const deck = JSON.parse(fs.readFileSync(deckPath, 'utf-8'));

  const chunk2 = {
    index: 2,
    timestamps: "01:10 - 02:18",
    text: deck.slides[1].bullets[0].citedChunkText,
    originalText: deck.slides[1].bullets[0].citedChunkText,
  };

  const chunk3 = {
    index: 3,
    timestamps: "02:18 - 03:27",
    text: deck.slides[2].bullets[0].citedChunkText,
    originalText: deck.slides[2].bullets[0].citedChunkText,
  };

  const client = getModelClient();

  const bullet1 = "Robots can solve problems using input from sensors";
  console.log(`Evaluating Bullet 1: "${bullet1}" against Chunk 2...`);
  const res1 = await gradeBulletAgainstSource(bullet1, chunk2 as any, client);
  console.log(`Result 1: Grade=${res1.grade}, Reason=${res1.reason}`);

  const bullet2 = "more versatile AI like Alexa can perform multiple tasks";
  console.log(`Evaluating Bullet 2: "${bullet2}" against Chunk 3...`);
  const res2 = await gradeBulletAgainstSource(bullet2, chunk3 as any, client);
  console.log(`Result 2: Grade=${res2.grade}, Reason=${res2.reason}`);

  const evidencePayload = {
    timestamp: new Date().toISOString(),
    audit: "Regression tests for false-accept bullets: sensors and versatile Alexa",
    results: [
      {
        bullet: bullet1,
        targetChunk: 2,
        grade: res1.grade,
        isVerified: res1.isVerified,
        reason: res1.reason,
        flaggedTerms: res1.flaggedTerms,
        rawUsage: res1.rawUsage,
        passedRequirement: res1.grade === 'NO SUPPORT',
      },
      {
        bullet: bullet2,
        targetChunk: 3,
        grade: res2.grade,
        isVerified: res2.isVerified,
        reason: res2.reason,
        flaggedTerms: res2.flaggedTerms,
        rawUsage: res2.rawUsage,
        passedRequirement: res2.grade === 'NO SUPPORT',
      },
    ],
  };

  const out1 = path.join(repoRoot, 'evidence/regression_false_accepts.json');
  const out2 = path.join(repoRoot, 'evidence/round39/regression_false_accepts.json');
  fs.mkdirSync(path.dirname(out2), { recursive: true });
  fs.writeFileSync(out1, JSON.stringify(evidencePayload, null, 2), 'utf-8');
  fs.writeFileSync(out2, JSON.stringify(evidencePayload, null, 2), 'utf-8');
  console.log(`Saved regression decisions to ${out1}`);
}

main().catch(err => {
  console.error('Fatal regression error:', err);
  process.exit(1);
});
