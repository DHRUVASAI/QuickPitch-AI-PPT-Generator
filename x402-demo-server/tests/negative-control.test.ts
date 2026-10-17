import { describe, it } from 'node:test';
import assert from 'node:assert';
import { gradeBulletAgainstSource } from '../core/synthesis/bullet-verifier.js';
import type { ChunkWithTime } from '../core/transcript/timestamp-utils.js';

describe('Item 5: Negative Control - 5 Injected Invented Bullets', () => {
  const sourceHindiChunk: ChunkWithTime & { originalText: string } = {
    index: 1,
    startSec: 0,
    endSec: 60,
    timestamps: '00:00 - 01:00',
    text: 'Imagine a machine that sets your wardrobe and serves coffee.',
    originalText: 'सोचिए कि कोई मशीन है जो आपके हिसाब से आपकी अलमारी सेट कर दे या आपके परिवार के हर मेंबर को उनकी पसंद के हिसाब से कॉफी सर्व कर दे बेसिकली आपका हर दिन आसान बना दे',
  };

  const inventedBullets = [
    'Dr. Victor Frankenstein tested neural microchips in Zurich in 1984.',
    'Masayoshi Son committed 50 billion dollars to quantum supercomputers.',
    'Kill switches were deployed across 450 nuclear silos by DARPA in 2030.',
    'Unemployment reached 42% due to robotic humanoid automation in Detroit.',
    'AlphaZero defeated Garry Kasparov 100-0 in deep chess matches.',
  ];

  it('should flag all 5 invented bullets as unverified / NO SUPPORT', async () => {
    for (let i = 0; i < inventedBullets.length; i++) {
      const bullet = inventedBullets[i];
      const result = await gradeBulletAgainstSource(bullet, sourceHindiChunk);

      assert.strictEqual(
        result.isVerified,
        false,
        `Expected invented bullet ${i + 1} to NOT be verified, but was marked verified: "${bullet}"`
      );

      assert.strictEqual(
        result.grade,
        'NO SUPPORT',
        `Expected invented bullet ${i + 1} to have grade 'NO SUPPORT', got '${result.grade}' for: "${bullet}"`
      );

      assert.ok(
        result.flaggedTerms.length > 0,
        `Expected invented bullet ${i + 1} to have flagged terms, got empty for: "${bullet}"`
      );

      console.log(`[Negative Control ${i + 1}/5 FLAGGED]: "${bullet}" -> Grade: ${result.grade}, Flags: [${result.flaggedTerms.join(', ')}]`);
    }
  });
});
