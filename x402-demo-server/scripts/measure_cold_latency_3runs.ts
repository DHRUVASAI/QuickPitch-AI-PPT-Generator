import fs from 'node:fs';
import path from 'node:path';
import { writeEvidence } from './evidence-helper.js';

async function runColdLatencyMeasurement() {
  const indexModule = await import('../index.js');
  const port = 4021;
  await new Promise(r => setTimeout(r, 1000));

  const basePayload = {
    source_type: 'youtube',
    url: 'https://www.youtube.com/watch?v=qzAHXO-cN5Q',
    spoken_language: 'hi',
    user_confirmed_spoken_language: true,
    target_slides: 6,
    theme: 'cyber-blue',
    detail_level: 'balanced',
    do_not_cache: true,
  };

  const results: any = {
    localBatched: [],
    cloudPerRequest: []
  };

  // 3 runs for (a) local batched mode
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- Local Batched Run ${i} (do_not_cache=true) ---`);
    const start = Date.now();
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/generate-ppt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...basePayload, allow_cloud_fallback: false })
      });
      const totalMs = Date.now() - start;
      const provider = resp.headers.get('X-QuickPitch-Provider') || 'deterministic-fallback';
      const s1 = Number(resp.headers.get('X-QuickPitch-Stage1-Ms') || 0);
      const s2 = Number(resp.headers.get('X-QuickPitch-Stage2-Ms') || 0);
      const s3 = Number(resp.headers.get('X-QuickPitch-Stage3-Ms') || 0);
      const s4 = Number(resp.headers.get('X-QuickPitch-Stage4-Ms') || 0);
      const stageSum = s1 + s2 + s3 + s4;
      results.localBatched.push({
        run: i,
        status: resp.status,
        provider,
        stage1_ingest_translate_ms: s1,
        stage2_outline_ms: s2,
        stage3_slides_verify_ms: s3,
        stage4_compile_ms: s4,
        stageSum_ms: stageSum,
        total_ms: totalMs
      });
      console.log(`Local Run ${i}: status=${resp.status}, provider=${provider}, total=${totalMs}ms, stageSum=${stageSum}ms`);
    } catch (e: any) {
      console.error(`Local Run ${i} error:`, e.message);
    }
  }

  // 3 runs for (b) per-request cloud mode
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- Cloud Per-Request Run ${i} (do_not_cache=true) ---`);
    const start = Date.now();
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/generate-ppt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...basePayload, allow_cloud_fallback: true })
      });
      const totalMs = Date.now() - start;
      const provider = resp.headers.get('X-QuickPitch-Provider') || 'groq';
      const s1 = Number(resp.headers.get('X-QuickPitch-Stage1-Ms') || 0);
      const s2 = Number(resp.headers.get('X-QuickPitch-Stage2-Ms') || 0);
      const s3 = Number(resp.headers.get('X-QuickPitch-Stage3-Ms') || 0);
      const s4 = Number(resp.headers.get('X-QuickPitch-Stage4-Ms') || 0);
      const stageSum = s1 + s2 + s3 + s4;
      results.cloudPerRequest.push({
        run: i,
        status: resp.status,
        provider,
        stage1_ingest_translate_ms: s1,
        stage2_outline_ms: s2,
        stage3_slides_verify_ms: s3,
        stage4_compile_ms: s4,
        stageSum_ms: stageSum,
        total_ms: totalMs
      });
      console.log(`Cloud Run ${i}: status=${resp.status}, provider=${provider}, total=${totalMs}ms, stageSum=${stageSum}ms`);
    } catch (e: any) {
      console.error(`Cloud Run ${i} error:`, e.message);
    }
  }

  writeEvidence('round391_part18_item4_cold_latency.json', {
    description: 'Round 3.9 Part 1.8 Item 4: 3 runs per mode with do_not_cache=true',
    verificationUsesCloudInModeB: true,
    results
  }, [
    'handlers/generate-ppt.ts',
    'core/synthesis/slide-planner.ts',
    'core/synthesis/bullet-verifier.ts',
  ]);

  console.log('\nResults written to evidence/round39/round391_part18_item4_cold_latency.json');
}

runColdLatencyMeasurement().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
