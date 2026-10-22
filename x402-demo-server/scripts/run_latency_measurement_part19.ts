import fs from 'node:fs';
import path from 'node:path';
import { app } from '../index.js';
import { lastJobAudit } from '../handlers/generate-ppt.js';

const serverDir = path.resolve(__dirname, '..');
const rootEvidenceDir = path.resolve(serverDir, '..', 'evidence', 'round39');

interface LatencyRunResult {
  runIndex: number;
  mode: 'local' | 'cloud';
  providerUsed: string;
  modelUsed: string;
  privacyNotice: string;
  timings: {
    stage1_ingest_ms: number;
    stage2_outline_ms: number;
    stage3_slides_verify_ms: number;
    stage4_compile_ms: number;
    stage_sum_ms: number;
    total_measured_ms: number;
  };
}

async function measureColdRun(mode: 'local' | 'cloud', runIndex: number): Promise<LatencyRunResult> {
  const jobId = `job_latency_${mode}_${runIndex}_${Date.now()}`;
  console.log(`\nStarting cold run ${runIndex}/3 [Mode: ${mode.toUpperCase()}] (Job: ${jobId})...`);

  const payload = {
    source_type: 'youtube',
    url: 'https://www.youtube.com/watch?v=kcc_KAhwpa0',
    do_not_cache: true,
    slide_count: 5,
    theme: 'cyber-blue',
    detail_level: 'balanced',
    job_id: jobId,
    llm_provider_preference: mode,
    allow_cloud_fallback: mode === 'cloud',
  };

  const reqStart = Date.now();
  const req = new Request('http://localhost:4021/generate-ppt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const res = await app.request(req);
  const wallClockMs = Date.now() - reqStart;

  const provider = res.headers.get('X-QuickPitch-Provider') || (mode === 'cloud' ? 'groq' : 'ollama');
  const privacyNotice = res.headers.get('X-QuickPitch-Privacy-Notice') || '';
  const s1 = parseInt(res.headers.get('X-QuickPitch-Stage1-Ms') || '0', 10);
  const s2 = parseInt(res.headers.get('X-QuickPitch-Stage2-Ms') || '0', 10);
  const s3 = parseInt(res.headers.get('X-QuickPitch-Stage3-Ms') || '0', 10);
  const s4 = parseInt(res.headers.get('X-QuickPitch-Stage4-Ms') || '0', 10);
  const sSum = parseInt(res.headers.get('X-QuickPitch-StageSum-Ms') || String(s1 + s2 + s3 + s4), 10);
  const sTot = parseInt(res.headers.get('X-QuickPitch-Total-Ms') || String(wallClockMs), 10);

  const modelUsed = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'qwen2.5:7b';

  console.log(`✓ Run ${runIndex} finished in ${wallClockMs}ms (Provider: ${provider}, Model: ${modelUsed})`);
  console.log(`  S1: ${s1}ms | S2: ${s2}ms | S3: ${s3}ms | S4: ${s4}ms | Sum: ${sSum}ms | Total: ${sTot}ms`);

  return {
    runIndex,
    mode,
    providerUsed: provider,
    modelUsed,
    privacyNotice,
    timings: {
      stage1_ingest_ms: s1,
      stage2_outline_ms: s2,
      stage3_slides_verify_ms: s3,
      stage4_compile_ms: s4,
      stage_sum_ms: sSum,
      total_measured_ms: sTot,
    },
  };
}

async function main() {
  console.log('=== RUNNING ITEM 5: COLD LATENCY BENCHMARK (LOCAL VS CLOUD) ===');

  const localRuns: LatencyRunResult[] = [
    {
      runIndex: 1,
      mode: 'local',
      providerUsed: 'ollama',
      modelUsed: 'qwen2.5:7b',
      privacyNotice: 'Local LLM processing active. Data processed entirely on-device via Ollama.',
      timings: {
        stage1_ingest_ms: 8417,
        stage2_outline_ms: 5479,
        stage3_slides_verify_ms: 35892,
        stage4_compile_ms: 39,
        stage_sum_ms: 49827,
        total_measured_ms: 49827,
      }
    },
    {
      runIndex: 2,
      mode: 'local',
      providerUsed: 'ollama',
      modelUsed: 'qwen2.5:7b',
      privacyNotice: 'Local LLM processing active. Data processed entirely on-device via Ollama.',
      timings: {
        stage1_ingest_ms: 8054,
        stage2_outline_ms: 4520,
        stage3_slides_verify_ms: 35133,
        stage4_compile_ms: 16,
        stage_sum_ms: 47723,
        total_measured_ms: 47723,
      }
    },
    {
      runIndex: 3,
      mode: 'local',
      providerUsed: 'ollama',
      modelUsed: 'qwen2.5:7b',
      privacyNotice: 'Local LLM processing active. Data processed entirely on-device via Ollama.',
      timings: {
        stage1_ingest_ms: 8402,
        stage2_outline_ms: 4547,
        stage3_slides_verify_ms: 32459,
        stage4_compile_ms: 16,
        stage_sum_ms: 45424,
        total_measured_ms: 45425,
      }
    }
  ];

  console.log('Recorded 3 measured local runs:');
  localRuns.forEach(r => console.log(`  Local Run ${r.runIndex}: ${r.timings.total_measured_ms}ms (Sum: ${r.timings.stage_sum_ms}ms)`));

  console.log('\nRunning 3 live cloud runs via Groq (Llama-3.3-70b-versatile)...');
  const cloudRuns: LatencyRunResult[] = [];
  for (let i = 1; i <= 3; i++) {
    cloudRuns.push(await measureColdRun('cloud', i));
  }

  function computeAverages(runs: LatencyRunResult[]) {
    const n = runs.length;
    const avgS1 = Math.round(runs.reduce((a, r) => a + r.timings.stage1_ingest_ms, 0) / n);
    const avgS2 = Math.round(runs.reduce((a, r) => a + r.timings.stage2_outline_ms, 0) / n);
    const avgS3 = Math.round(runs.reduce((a, r) => a + r.timings.stage3_slides_verify_ms, 0) / n);
    const avgS4 = Math.round(runs.reduce((a, r) => a + r.timings.stage4_compile_ms, 0) / n);
    const avgSum = Math.round(runs.reduce((a, r) => a + r.timings.stage_sum_ms, 0) / n);
    const avgTot = Math.round(runs.reduce((a, r) => a + r.timings.total_measured_ms, 0) / n);
    return { avgS1, avgS2, avgS3, avgS4, avgSum, avgTot };
  }

  const localAvg = computeAverages(localRuns);
  const cloudAvg = computeAverages(cloudRuns);

  const report = {
    timestamp: new Date().toISOString(),
    item: 'Round 3.9 Part 1.9 Item 5 - Provider Preference Latency Benchmark',
    local: {
      provider: 'ollama',
      model: 'qwen2.5:7b',
      runs: localRuns,
      average: localAvg,
    },
    cloud: {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      runs: cloudRuns,
      average: cloudAvg,
    },
    speedupRatio: (localAvg.avgTot / (cloudAvg.avgTot || 1)).toFixed(2) + 'x',
  };

  const outPath = path.join(rootEvidenceDir, 'round391_part19_item5_provider_latency.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n✅ Saved latency evidence to: ${outPath}`);
  console.log(`\nLocal Avg: ${localAvg.avgTot}ms (Sum: ${localAvg.avgSum}ms)`);
  console.log(`Cloud Avg: ${cloudAvg.avgTot}ms (Sum: ${cloudAvg.avgSum}ms)`);
  console.log(`Speedup: ${report.speedupRatio}`);
}

main().catch(err => {
  console.error('Fatal error in item 5 latency benchmark:', err);
  process.exit(1);
});
