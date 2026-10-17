import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  formatMmSs,
  parseMmSs,
  calculateSlideSourceRange,
  buildChunksFromSegments,
} from '../core/transcript/timestamp-utils.js';

describe('Item 2: Timestamp Labeling, Chunk Range, and Clamping Tests', () => {
  describe('formatMmSs() shared function', () => {
    it('should format 0s as 00:00', () => {
      assert.strictEqual(formatMmSs(0), '00:00');
    });

    it('should format 65.4s as 01:05', () => {
      assert.strictEqual(formatMmSs(65.4), '01:05');
    });

    it('should format 327.9s as 05:27', () => {
      assert.strictEqual(formatMmSs(327.9), '05:27');
    });

    it('should handle edge cases like negative or NaN gracefully', () => {
      assert.strictEqual(formatMmSs(-10), '00:00');
      assert.strictEqual(formatMmSs(NaN), '00:00');
    });

    it('should ensure label matches numeric values (round-trip test)', () => {
      const testCases = [0, 15, 60, 75.4, 128.2, 245.9, 327.9];
      for (const sec of testCases) {
        const label = formatMmSs(sec);
        const parsedSec = parseMmSs(label);
        const expectedSec = Math.floor(sec);
        assert.strictEqual(parsedSec, expectedSec, `Label "${label}" must match floor of numeric seconds ${sec}`);
      }
    });
  });

  describe('calculateSlideSourceRange() and Video Duration Clamping', () => {
    const videoDuration = 327.9;

    it('should clamp source_end to video duration when chunks exceed duration', () => {
      const chunks = [
        { startSec: 250.0, endSec: 350.0 }, // 350 exceeds 327.9
      ];
      const result = calculateSlideSourceRange(chunks, videoDuration);

      assert.strictEqual(result.source_start, 250.0);
      assert.strictEqual(result.source_end, 327.9);
      assert.strictEqual(result.source_end <= videoDuration, true, 'source_end must be <= videoDuration');
      assert.strictEqual(result.source_timestamps, '04:10 - 05:27');
    });

    it('should calculate min start and max end across multiple chunks used', () => {
      const chunks = [
        { startSec: 81.9, endSec: 120.0 },
        { startSec: 120.0, endSec: 163.9 },
      ];
      const result = calculateSlideSourceRange(chunks, videoDuration);

      assert.strictEqual(result.source_start, 81.9);
      assert.strictEqual(result.source_end, 163.9);
      assert.strictEqual(result.source_end <= videoDuration, true);
      assert.strictEqual(result.source_timestamps, '01:21 - 02:43');
    });

    it('should clamp negative starts to 0.0', () => {
      const chunks = [{ startSec: -5.0, endSec: 45.0 }];
      const result = calculateSlideSourceRange(chunks, videoDuration);

      assert.strictEqual(result.source_start, 0.0);
      assert.strictEqual(result.source_end, 45.0);
      assert.strictEqual(result.source_timestamps, '00:00 - 00:45');
    });

    it('should strictly guarantee end <= duration under any arbitrary numbers', () => {
      const arbitraryLimits = [10, 50.5, 100, 327.9, 3600];
      for (const dur of arbitraryLimits) {
        const result = calculateSlideSourceRange([{ startSec: 0, endSec: dur + 1000 }], dur);
        assert.ok(result.source_end <= dur, `End ${result.source_end} must not exceed duration ${dur}`);
        const parsedEnd = parseMmSs(result.source_timestamps.split(' - ')[1]);
        assert.ok(parsedEnd <= Math.floor(dur) + 1, 'Formatted end timestamp must be bounded by duration');
      }
    });
  });

  describe('buildChunksFromSegments() from real segment times', () => {
    it('should build contiguous chunks using real segment boundaries clamped to duration', () => {
      const segments = [
        { start: 0.4, end: 25.0, text: 'Seg 1' },
        { start: 25.0, end: 55.0, text: 'Seg 2' },
        { start: 55.0, end: 120.0, text: 'Seg 3' },
        { start: 120.0, end: 200.0, text: 'Seg 4' },
        { start: 200.0, end: 330.0, text: 'Seg 5' }, // 330 exceeds 327.9
      ];

      const chunks = buildChunksFromSegments(segments, 3, 327.9);
      assert.strictEqual(chunks.length, 3);
      assert.strictEqual(chunks[0].startSec, 0.4);
      assert.strictEqual(chunks[chunks.length - 1].endSec, 327.9);
      assert.ok(chunks[chunks.length - 1].endSec <= 327.9);
      for (const c of chunks) {
        assert.ok(c.endSec <= 327.9, `Chunk ${c.index} end ${c.endSec} must be <= 327.9`);
        assert.strictEqual(c.timestamps, `${formatMmSs(c.startSec)} - ${formatMmSs(c.endSec)}`);
      }
    });
  });
});
