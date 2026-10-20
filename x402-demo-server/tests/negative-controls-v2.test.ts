import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config();

import { gradeBulletAgainstSource } from '../core/synthesis/bullet-verifier.js';
import type { ChunkWithTime } from '../core/transcript/timestamp-utils.js';
import { GroqProvider } from '../models/providers/groq.provider.js';
import { UnifiedModelClient } from '../models/unified-client.js';

describe('Item 6: Negative Controls v2 - 10 Injected + 5 Positive Controls', () => {
  // Load full deduped Hindi text as reference
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
  const modelName = 'openai/gpt-oss-20b via Groq';

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

  it('should flag all 5 named/numbered negative controls as NO SUPPORT', async () => {
    let flagged = 0;
    for (const bullet of group1_named) {
      const res = await gradeBulletAgainstSource(bullet, fullChunk, client);
      if (!res.isVerified) flagged++;
      assert.strictEqual(res.isVerified, false, `Expected unverified for: "${bullet}"`);
      assert.strictEqual(res.grade, 'NO SUPPORT');
    }
    assert.strictEqual(flagged, 5, 'All 5 named negative controls must be flagged');
  });

  it('should flag all 5 fluent claim negative controls as NO SUPPORT', async () => {
    let flagged = 0;
    for (const bullet of group2_fluent) {
      const res = await gradeBulletAgainstSource(bullet, fullChunk, client);
      if (!res.isVerified) flagged++;
      assert.strictEqual(res.isVerified, false, `Expected unverified for: "${bullet}"`);
      assert.strictEqual(res.grade, 'NO SUPPORT');
    }
    assert.strictEqual(flagged, 5, 'All 5 fluent claim negative controls must be flagged');
  });

  it('should accept positive controls as verified', async () => {
    let accepted = 0;
    for (const bullet of group3_positive) {
      const res = await gradeBulletAgainstSource(bullet, fullChunk, client);
      if (res.isVerified) accepted++;
      assert.strictEqual(res.isVerified, true, `Expected verified for positive control: "${bullet}", reason: ${res.reason}`);
    }
    assert.strictEqual(accepted, 5, 'All 5 positive controls must be accepted');
  });
});
