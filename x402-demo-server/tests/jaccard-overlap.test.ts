import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeJaccardWordOverlap } from '../core/utils/jaccard.js';

describe('Jaccard Word Overlap Utility Tests', () => {
  it('Pair 1: hand-computed Jaccard on "artificial intelligence is powerful" vs "artificial intelligence is dangerous"', () => {
    const textA = 'artificial intelligence is powerful';
    const textB = 'artificial intelligence is dangerous';
    // Words A: {artificial, intelligence, is, powerful} (4)
    // Words B: {artificial, intelligence, is, dangerous} (4)
    // Intersection: {artificial, intelligence, is} (3)
    // Union: {artificial, intelligence, is, powerful, dangerous} (5)
    // Jaccard: 3 / 5 = 0.6000
    const overlap = computeJaccardWordOverlap(textA, textB);
    assert.strictEqual(overlap, 0.6000);
  });

  it('Pair 2: hand-computed Jaccard on "weak ai performs one single task" vs "narrow ai performs one task"', () => {
    const textA = 'weak ai performs one single task';
    const textB = 'narrow ai performs one task';
    // Words A: {weak, ai, performs, one, single, task} (6)
    // Words B: {narrow, ai, performs, one, task} (5)
    // Intersection: {ai, performs, one, task} (4)
    // Union: {weak, narrow, ai, performs, one, single, task} (7)
    // Jaccard: 4 / 7 = 0.5714 (rounded to 4 decimal places)
    const overlap = computeJaccardWordOverlap(textA, textB);
    assert.strictEqual(overlap, 0.5714);
  });

  it('should return 1.0 for identical sentences', () => {
    const text = 'Deep learning is a subset of machine learning.';
    assert.strictEqual(computeJaccardWordOverlap(text, text), 1.0);
  });

  it('should return 0.0 for completely disjoint sentences', () => {
    const textA = 'Apples oranges bananas';
    const textB = 'Quantum physics semiconductor lasers';
    assert.strictEqual(computeJaccardWordOverlap(textA, textB), 0.0);
  });
});
