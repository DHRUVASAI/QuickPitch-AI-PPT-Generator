import fs from 'fs';
import path from 'path';

const serverDir = path.resolve(__dirname, '..');
const repoRootDir = path.resolve(serverDir, '..');

function main() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('SCOREBOARD VERIFIER / RECOMPUTE TOTALS (npm run scoreboard:check)');
  console.log('════════════════════════════════════════════════════════════════════\n');

  const jsonPath = path.join(repoRootDir, 'evidence/scoreboard.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`FATAL: evidence/scoreboard.json does not exist at ${jsonPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch (err: any) {
    console.error(`FATAL: Failed to parse scoreboard.json: ${err.message}`);
    process.exit(1);
  }

  if (!data.gitCommit || !data.timestamp || !Array.isArray(data.videos)) {
    console.error('FATAL: scoreboard.json missing top-level fields (gitCommit, timestamp, videos array).');
    process.exit(1);
  }

  console.log(`Commit: ${data.gitCommit}`);
  console.log(`Timestamp: ${data.timestamp}`);
  console.log(`Videos in report: ${data.videos.length}\n`);

  let allChecksPassed = true;

  data.videos.forEach((v: any, idx: number) => {
    console.log(`────────────────────────────────────────────────────────────────────`);
    console.log(`Video [${idx + 1}/${data.videos.length}]: ${v.videoId} ("${v.ytdlpTitle}")`);
    console.log(`────────────────────────────────────────────────────────────────────`);

    // 1. Verify stage sum
    const t = v.stageTimings || {};
    const computedSum = (t.stage1_ingest_ms || 0) + (t.stage2_outline_ms || 0) + (t.stage3_slides_verify_ms || 0) + (t.stage4_compile_ms || 0);
    const recordedSum = t.stage_sum_ms;

    if (computedSum !== recordedSum) {
      console.error(`❌ SUM DISAGREEMENT on video ${v.videoId}:`);
      console.error(`   Computed (S1+S2+S3+S4): ${computedSum} ms`);
      console.error(`   Recorded stage_sum_ms: ${recordedSum} ms`);
      allChecksPassed = false;
    } else {
      console.log(`✓ Stage sum verified: ${t.stage1_ingest_ms} + ${t.stage2_outline_ms} + ${t.stage3_slides_verify_ms} + ${t.stage4_compile_ms} == ${recordedSum} ms`);
    }

    // 2. Verify per-stage timings list matches stageTimings
    if (Array.isArray(v.perStageServerTimings)) {
      const pSum = v.perStageServerTimings.reduce((acc: number, cur: any) => acc + (cur.ms || 0), 0);
      if (pSum !== recordedSum) {
        console.error(`❌ PER-STAGE ARRAY SUM DISAGREEMENT: array sum ${pSum} != recorded ${recordedSum}`);
        allChecksPassed = false;
      } else {
        console.log(`✓ Per-stage timing array verified (sum: ${pSum} ms).`);
      }
    }

    // 3. Recompute bullet totals
    const bullets: any[] = v.bullets || [];
    const recomputedGenerated = bullets.length;
    const recomputedVerified = bullets.filter((b: any) => b.pass === true).length;
    const recomputedDropped = bullets.filter((b: any) => b.pass === false).length;

    const recordedGenerated = v.counts?.generated;
    const recordedVerified = v.counts?.verified;
    const recordedDropped = v.counts?.dropped;

    console.log(`   Bullets Count Recompute:`);
    console.log(`     Generated: recomputed=${recomputedGenerated}, recorded=${recordedGenerated}`);
    console.log(`     Verified:  recomputed=${recomputedVerified}, recorded=${recordedVerified}`);
    console.log(`     Dropped:   recomputed=${recomputedDropped}, recorded=${recordedDropped}`);

    if (recomputedGenerated !== recordedGenerated) {
      console.error(`❌ GENERATED COUNT DISAGREEMENT: ${recomputedGenerated} != ${recordedGenerated}`);
      allChecksPassed = false;
    }

    if (recomputedVerified !== recordedVerified) {
      console.error(`❌ VERIFIED COUNT DISAGREEMENT: ${recomputedVerified} != ${recordedVerified}`);
      allChecksPassed = false;
    }

    if (recomputedDropped !== recordedDropped) {
      console.error(`❌ DROPPED COUNT DISAGREEMENT: ${recomputedDropped} != ${recordedDropped}`);
      allChecksPassed = false;
    }

    if (recomputedVerified + recomputedDropped !== recomputedGenerated) {
      console.error(`❌ AUTO-CHECK DISAGREEMENT: ${recomputedVerified} + ${recomputedDropped} != ${recomputedGenerated}`);
      allChecksPassed = false;
    } else {
      console.log(`✓ Auto-check verified: ${recomputedVerified} + ${recomputedDropped} == ${recomputedGenerated} (PASS)\n`);
    }
  });

  if (!allChecksPassed) {
    console.error('💥 SCOREBOARD CHECK FAILED: Discrepancy found in recorded totals, sums or counts.');
    process.exit(1);
  }

  console.log('════════════════════════════════════════════════════════════════════');
  console.log('✅ ALL TOTALS, SUMS, AND COUNTS VERIFIED PERFECTLY.');
  console.log('════════════════════════════════════════════════════════════════════');
  process.exit(0);
}

main();
