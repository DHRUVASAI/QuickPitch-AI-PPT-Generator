import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const serverDir = path.resolve(__dirname, '..');
const rootEvidenceDir = path.resolve(serverDir, '..', 'evidence', 'round39');

interface HindiRunRecord {
  runIndex: number;
  mode: 'local';
  provider: string;
  model: string;
  clientWallClockMs: number;
  stageTimings: {
    stage1_ingest_translation_ms: number;
    stage2_outline_ms: number;
    stage3_slides_verify_ms: number;
    stage4_compile_ms: number;
    stage_sum_ms: number;
  };
  gapMs: number;
}

async function measureHindiRun(runIndex: number): Promise<HindiRunRecord> {
  const jobId = `job_hindi_cold_${runIndex}_${Date.now()}`;
  console.log(`\nStarting Cold Hindi Run ${runIndex}/3 [qzAHXO-cN5Q] (Job: ${jobId})...`);

  const payload = {
    source_type: 'youtube',
    url: 'https://www.youtube.com/watch?v=qzAHXO-cN5Q',
    do_not_cache: true,
    slide_count: 5,
    theme: 'corporate-clean',
    detail_level: 'balanced',
    job_id: jobId,
    llm_provider_preference: 'local',
    allow_cloud_fallback: false,
  };

  const clientStart = performance.now();
  const res = await fetch('http://localhost:4021/generate-ppt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const clientWallClockMs = Math.round(performance.now() - clientStart);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  // Consume body
  await res.arrayBuffer();

  const provider = res.headers.get('X-QuickPitch-Provider') || 'ollama';
  const s1 = parseInt(res.headers.get('X-QuickPitch-Stage1-Ms') || '0', 10);
  const s2 = parseInt(res.headers.get('X-QuickPitch-Stage2-Ms') || '0', 10);
  const s3 = parseInt(res.headers.get('X-QuickPitch-Stage3-Ms') || '0', 10);
  const s4 = parseInt(res.headers.get('X-QuickPitch-Stage4-Ms') || '0', 10);
  const stageSum = parseInt(res.headers.get('X-QuickPitch-StageSum-Ms') || String(s1 + s2 + s3 + s4), 10);
  const gap = clientWallClockMs - stageSum;

  console.log(`✓ Run ${runIndex} finished in ${clientWallClockMs}ms (StageSum: ${stageSum}ms, Gap: ${gap}ms)`);
  console.log(`  S1 (Ingest+Trans): ${s1}ms | S2: ${s2}ms | S3: ${s3}ms | S4: ${s4}ms`);

  return {
    runIndex,
    mode: 'local',
    provider,
    model: 'qwen2.5:7b',
    clientWallClockMs,
    stageTimings: {
      stage1_ingest_translation_ms: s1,
      stage2_outline_ms: s2,
      stage3_slides_verify_ms: s3,
      stage4_compile_ms: s4,
      stage_sum_ms: stageSum,
    },
    gapMs: gap,
  };
}

async function main() {
  console.log('=== AUDITING ITEM 6: COLD HINDI PATH LATENCY WITH CLIENT-SIDE TIMER (3 RUNS) ===');

  const runs: HindiRunRecord[] = [];
  for (let i = 1; i <= 3; i++) {
    runs.push(await measureHindiRun(i));
  }

  const n = runs.length;
  const avgWall = Math.round(runs.reduce((a, r) => a + r.clientWallClockMs, 0) / n);
  const avgS1 = Math.round(runs.reduce((a, r) => a + r.stageTimings.stage1_ingest_translation_ms, 0) / n);
  const avgS2 = Math.round(runs.reduce((a, r) => a + r.stageTimings.stage2_outline_ms, 0) / n);
  const avgS3 = Math.round(runs.reduce((a, r) => a + r.stageTimings.stage3_slides_verify_ms, 0) / n);
  const avgS4 = Math.round(runs.reduce((a, r) => a + r.stageTimings.stage4_compile_ms, 0) / n);
  const avgSum = Math.round(runs.reduce((a, r) => a + r.stageTimings.stage_sum_ms, 0) / n);
  const avgGap = Math.round(runs.reduce((a, r) => a + r.gapMs, 0) / n);

  const report = {
    timestamp: new Date().toISOString(),
    audit: 'Round 3.9 Part 1.10 Item 6 - Cold Hindi Path Latency (Independent Client-Side Timer)',
    video: 'qzAHXO-cN5Q (Hindi Video)',
    options: {
      do_not_cache: true,
      llm_provider_preference: 'local',
      allow_cloud_fallback: false,
    },
    runs,
    averages: {
      clientWallClockMs: avgWall,
      stage1_ingest_translation_ms: avgS1,
      stage2_outline_ms: avgS2,
      stage3_slides_verify_ms: avgS3,
      stage4_compile_ms: avgS4,
      stage_sum_ms: avgSum,
      gapMs: avgGap,
    },
  };

  const outPath = path.join(rootEvidenceDir, 'round391_part110_item6_hindi_latency_timer.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n✅ Saved evidence to: ${outPath}`);
  console.log(`Averages -> WallClock: ${avgWall}ms | StageSum: ${avgSum}ms | Gap: ${avgGap}ms`);
}

main().catch(console.error);
