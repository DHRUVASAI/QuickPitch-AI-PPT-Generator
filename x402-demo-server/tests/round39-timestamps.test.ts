import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { calculateSlideSourceRange, formatMmSs } from '../core/transcript/timestamp-utils.js';
import { planSlideStructure } from '../core/synthesis/slide-planner.js';

describe('Round 3.9 Item 3: Timestamps, Clamping, and Duration Verification', () => {
  const qzDuration = 327.889; // qzAHXO-cN5Q real duration: 5m 27.9s
  const kccDuration = 146.8;   // kcc_KAhwpa0 real duration: 2m 26.8s

  describe('3a: Fail loudly on unknown video duration in slide-planner', () => {
    it('should throw an error when video duration is undefined or missing in metadata', async () => {
      const mockOutline: any = {
        title: 'Test Presentation',
        slides: [{ title: 'Slide 1', keyPoints: ['Point 1'] }],
      };
      const mockTranscript: any = {
        title: 'Unknown Video',
        rawText: 'Some transcript text here for testing',
        sanitizedText: 'Some transcript text here for testing',
        metadata: {
          // durationSeconds is intentionally missing!
        },
      };

      await assert.rejects(
        async () => {
          await planSlideStructure(mockOutline, mockTranscript, undefined as any, 'cyber-blue', 'balanced');
        },
        {
          name: 'Error',
          message: /\[SlidePlanner\] Unknown video duration/,
        }
      );
    });
  });

  describe('3b: Whisper times must come straight from saved segment file unrounded', () => {
    it('should read unrounded floating-point timestamps from qzAHXO-cN5Q large-v3 file', () => {
      const whisperPath = path.resolve('scratch/qzAHXO_large_v3_translate.json');
      assert.ok(fs.existsSync(whisperPath), 'whisper file must exist');
      const data = JSON.parse(fs.readFileSync(whisperPath, 'utf-8'));

      assert.strictEqual(data.duration, 327.889);
      const seg1 = data.segments[0];
      assert.strictEqual(seg1.start, 0.0);
      assert.strictEqual(seg1.end, 4.24);

      const seg2 = data.segments[1];
      assert.strictEqual(seg2.start, 4.24);
      assert.strictEqual(seg2.end, 8.36);

      const seg3 = data.segments[2];
      assert.strictEqual(seg3.start, 8.36);
      assert.strictEqual(seg3.end, 10.92);

      // Verify unrounded float values are preserved
      assert.strictEqual(typeof seg1.end, 'number');
      assert.ok(seg1.end === 4.24);
    });
  });

  describe('3c: Slide ranges derived from cited chunks, clamped to video duration and ordered', () => {
    it('should clamp chunks for qzAHXO-cN5Q (327.889s) and maintain time order', () => {
      const chunks = [
        { startSec: 0.0, endSec: 45.24 },
        { startSec: 45.24, endSec: 120.5 },
        { startSec: 120.5, endSec: 250.75 },
        { startSec: 250.75, endSec: 350.0 }, // 350 exceeds 327.889!
      ];

      const range1 = calculateSlideSourceRange([chunks[0]], qzDuration);
      assert.strictEqual(range1.source_start, 0.0);
      assert.strictEqual(range1.source_end, 45.2);
      assert.strictEqual(range1.source_timestamps, '00:00 - 00:45');

      const rangeLast = calculateSlideSourceRange([chunks[3]], qzDuration);
      assert.strictEqual(rangeLast.source_start, 250.8);
      assert.strictEqual(rangeLast.source_end, 327.9); // Strictly clamped to 327.9!
      assert.ok(rangeLast.source_end <= qzDuration + 0.1);
      assert.strictEqual(rangeLast.source_timestamps, '04:10 - 05:27');
    });

    it('should clamp chunks for kcc_KAhwpa0 (146.8s) and never exceed duration', () => {
      const chunks = [
        { startSec: 0.32, endSec: 45.04 },
        { startSec: 45.04, endSec: 115.2 },
        { startSec: 115.2, endSec: 160.0 }, // 160 exceeds 146.8!
      ];

      const rangeFirst = calculateSlideSourceRange([chunks[0]], kccDuration);
      assert.strictEqual(rangeFirst.source_start, 0.3);
      assert.strictEqual(rangeFirst.source_end, 45.0);
      assert.strictEqual(rangeFirst.source_timestamps, '00:00 - 00:45');

      const rangeLast = calculateSlideSourceRange([chunks[2]], kccDuration);
      assert.strictEqual(rangeLast.source_start, 115.2);
      assert.strictEqual(rangeLast.source_end, 146.8); // Strictly clamped to 146.8!
      assert.ok(rangeLast.source_end <= kccDuration);
      assert.strictEqual(rangeLast.source_timestamps, '01:55 - 02:26');
    });

    it('should calculate multiple cited chunks by min start and max end', () => {
      const cited = [
        { startSec: 30.5, endSec: 60.0 },
        { startSec: 15.0, endSec: 45.0 },
      ];
      const range = calculateSlideSourceRange(cited, qzDuration);
      assert.strictEqual(range.source_start, 15.0); // min
      assert.strictEqual(range.source_end, 60.0);   // max
      assert.strictEqual(range.source_timestamps, '00:15 - 01:00');
    });
  });
});
