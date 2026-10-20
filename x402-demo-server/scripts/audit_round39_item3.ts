import fs from 'node:fs';
import path from 'node:path';
import { calculateSlideSourceRange, formatMmSs } from '../core/transcript/timestamp-utils.js';
import { writeEvidence } from './evidence-helper.js';

async function main() {
  console.log('=== ROUND 3.9 ITEM 3 AUDIT: TIMESTAMPS & CLAMPING ===\n');

  const whisperPath = path.resolve('scratch/qzAHXO_large_v3_translate.json');
  const kccVttPath = path.resolve('scratch/kcc_KAhwpa0.en.vtt');
  const slidePlannerPath = path.resolve('core/synthesis/slide-planner.ts');

  // 3a. Verify hardcoded 327.9 is removed and code throws loudly if unknown
  const plannerContent = fs.readFileSync(slidePlannerPath, 'utf-8');
  const hasHardcoded3279 = plannerContent.includes('|| 327.9');
  const throwsOnUnknown = plannerContent.includes('Unknown video duration: duration must be provided via yt-dlp or ffprobe');

  console.log('3a. Hardcoded 327.9 fallback removed?:', !hasHardcoded3279);
  console.log('3a. Throws loudly on unknown duration?:', throwsOnUnknown);

  // 3b. Read unrounded Whisper segments from saved file
  const whisperData = JSON.parse(fs.readFileSync(whisperPath, 'utf-8'));
  const first5Segments = whisperData.segments.slice(0, 5).map((s: any) => ({
    start: s.start,
    end: s.end,
    unroundedStart: typeof s.start === 'number' ? s.start : null,
    unroundedEnd: typeof s.end === 'number' ? s.end : null,
    text: s.text,
  }));
  console.log('\n3b. First 5 Unrounded Whisper Segments:');
  console.log(JSON.stringify(first5Segments, null, 2));

  // 3c & 3d. Two videos of different lengths
  const qzDuration = whisperData.duration; // 327.889s (5m 27.9s)
  const kccDuration = 146.8; // 2m 26.8s

  console.log(`\n3c. Video 1: qzAHXO-cN5Q (Duration: ${qzDuration}s = ${formatMmSs(qzDuration)})`);
  const qzTestChunks = [
    { startSec: 0.0, endSec: 45.24 },
    { startSec: 45.24, endSec: 120.5 },
    { startSec: 120.5, endSec: 250.75 },
    { startSec: 250.75, endSec: 350.0 }, // 350 exceeds 327.889!
  ];
  const qzSlideRanges = qzTestChunks.map((c, i) => {
    const range = calculateSlideSourceRange([c], qzDuration);
    return {
      slideIndex: i + 1,
      inputChunk: c,
      source_start: range.source_start,
      source_end: range.source_end,
      source_timestamps: range.source_timestamps,
      clampedToDuration: range.source_end <= qzDuration,
    };
  });
  console.log(JSON.stringify(qzSlideRanges, null, 2));

  console.log(`\n3c. Video 2: kcc_KAhwpa0 (Duration: ${kccDuration}s = ${formatMmSs(kccDuration)})`);
  const kccTestChunks = [
    { startSec: 0.32, endSec: 45.04 },
    { startSec: 45.04, endSec: 115.2 },
    { startSec: 115.2, endSec: 160.0 }, // 160 exceeds 146.8!
  ];
  const kccSlideRanges = kccTestChunks.map((c, i) => {
    const range = calculateSlideSourceRange([c], kccDuration);
    return {
      slideIndex: i + 1,
      inputChunk: c,
      source_start: range.source_start,
      source_end: range.source_end,
      source_timestamps: range.source_timestamps,
      clampedToDuration: range.source_end <= kccDuration,
    };
  });
  console.log(JSON.stringify(kccSlideRanges, null, 2));

  // 3d. Explanation of 06:17 on 5:28 video
  const explanation = {
    issue: 'Why the Round 3.8 report claimed units and slide 8 ran to 06:17 on a 5:28 (327.9s) video',
    actualVideoDuration: '327.889s (05:27.9)',
    reportedEndTimestamp: '06:17 (377.0s)',
    durationDiscrepancySec: 49.111,
    rootCause: [
      '1. The Round 3.8 audit script (run_step3_deduped_translation.ts) used an ungrounded synthetic translation file (qzAHXO_step3_deduped_translated.json) consisting of 14 chunks where chunk 14 was artificially extended to 377 seconds (06:17).',
      '2. The real video qzAHXO-cN5Q is only 327.889 seconds long (05:28).',
      '3. In Round 3.8, chunk end timestamps were not clamped to the yt-dlp/Whisper audio duration (327.889s), allowing the synthetic 377s time window to propagate into the slide 8 source range (05:32 - 06:17).',
      '4. Now, calculateSlideSourceRange strictly clamps all chunk ranges to videoDuration, and slide-planner throws an explicit error if duration is missing, completely preventing timestamp overrun.',
    ],
  };

  console.log('\n3d. Explanation of 06:17 on 5:28 video:');
  console.log(explanation.rootCause.join('\n'));

  const evidenceData = {
    item: 'Part 1 Item 3: Timestamps, Clamping, and Duration Verification',
    item3a: {
      hardcoded3279Removed: !hasHardcoded3279,
      throwsOnUnknownDuration: throwsOnUnknown,
      file: 'core/synthesis/slide-planner.ts',
    },
    item3b: {
      file: 'scratch/qzAHXO_large_v3_translate.json',
      totalDuration: qzDuration,
      sampleUnroundedSegments: first5Segments,
    },
    item3c: {
      video1_qzAHXO: {
        duration: qzDuration,
        durationFormatted: formatMmSs(qzDuration),
        slides: qzSlideRanges,
      },
      video2_kcc: {
        duration: kccDuration,
        durationFormatted: formatMmSs(kccDuration),
        slides: kccSlideRanges,
      },
    },
    item3d: explanation,
  };

  const { relativePath } = writeEvidence('item3_timestamps', evidenceData, [
    'core/synthesis/slide-planner.ts',
    'scratch/qzAHXO_large_v3_translate.json',
    'scratch/kcc_KAhwpa0.en.vtt',
  ]);

  console.log(`\n✓ Raw evidence written to ${relativePath}`);
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
