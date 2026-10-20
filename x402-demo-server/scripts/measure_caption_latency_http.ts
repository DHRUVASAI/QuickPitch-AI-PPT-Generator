import fs from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { writeEvidence } from './evidence-helper.js';

async function runMeasurement() {
  // 1. Dynamically import app from index.ts
  const indexModule = await import('../index.js');
  const app = (indexModule as any).app || (indexModule as any).default;

  const port = 4021;
  try {
    // Wait 1000ms for index.ts server to start listening
    await new Promise((r) => setTimeout(r, 1000));

    // Capture logs
    const capturedLogs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => {
      origLog(...args);
      capturedLogs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    };

    // Payload for caption path (YouTube qzAHXO-cN5Q, spoken language confirmed Hindi)
    const basePayload = {
      source_type: 'youtube',
      url: 'https://www.youtube.com/watch?v=qzAHXO-cN5Q',
      spoken_language: 'hi',
      user_confirmed_spoken_language: true,
      target_slides: 6,
      theme: 'cyber-blue',
      detail_level: 'balanced',
      do_not_cache: false,
    };

    // ── Measurement A: Local Mode (allow_cloud_fallback: false) ───────────
    console.log('\n--- MEASURING (A): LOCAL BATCHED MODE ---');
    const startLocal = Date.now();
    const respLocal = await fetch(`http://127.0.0.1:${port}/generate-ppt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        allow_cloud_fallback: false,
      }),
    });
    const totalLocalHttpMs = Date.now() - startLocal;
    const localStatus = respLocal.status;
    const localProvider = respLocal.headers.get('X-QuickPitch-Provider') || 'unknown';
    const s1Local = Number(respLocal.headers.get('X-QuickPitch-Stage1-Ms') || 0);
    const s2Local = Number(respLocal.headers.get('X-QuickPitch-Stage2-Ms') || 0);
    const s3Local = Number(respLocal.headers.get('X-QuickPitch-Stage3-Ms') || 0);
    const s4Local = Number(respLocal.headers.get('X-QuickPitch-Stage4-Ms') || 0);
    const stageSumLocal = s1Local + s2Local + s3Local + s4Local;

    console.log(`Local Mode Response: Status=${localStatus}, Provider=${localProvider}, Total=${totalLocalHttpMs}ms, StageSum=${stageSumLocal}ms`);

    // ── Measurement B: Cloud Mode (allow_cloud_fallback: true) ────────────
    console.log('\n--- MEASURING (B): PER-REQUEST CLOUD MODE ---');
    const startCloud = Date.now();
    const respCloud = await fetch(`http://127.0.0.1:${port}/generate-ppt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        allow_cloud_fallback: true,
      }),
    });
    const totalCloudHttpMs = Date.now() - startCloud;
    const cloudStatus = respCloud.status;
    const cloudProvider = respCloud.headers.get('X-QuickPitch-Provider') || 'unknown';
    const s1Cloud = Number(respCloud.headers.get('X-QuickPitch-Stage1-Ms') || 0);
    const s2Cloud = Number(respCloud.headers.get('X-QuickPitch-Stage2-Ms') || 0);
    const s3Cloud = Number(respCloud.headers.get('X-QuickPitch-Stage3-Ms') || 0);
    const s4Cloud = Number(respCloud.headers.get('X-QuickPitch-Stage4-Ms') || 0);
    const stageSumCloud = s1Cloud + s2Cloud + s3Cloud + s4Cloud;

    console.log(`Cloud Mode Response: Status=${cloudStatus}, Provider=${cloudProvider}, Total=${totalCloudHttpMs}ms, StageSum=${stageSumCloud}ms`);

    console.log = origLog;

    // Filter server logs for timing entries
    const timingLogs = capturedLogs.filter(l => l.includes('[QuickPitch Timing]') || l.includes('[QuickPitch Stage'));

    // Write evidence file
    const evidenceData = {
      description: 'End-to-end latency measurement through the real HTTP endpoint (/generate-ppt) for caption-driven generation.',
      testUrl: basePayload.url,
      endpoint: `http://127.0.0.1:${port}/generate-ppt`,
      measurements: {
        localBatchedMode: {
          allowCloudFallback: false,
          httpStatus: localStatus,
          providerUsed: localProvider,
          stage1_transcriptIngestion_ms: s1Local,
          stage2_outlineSynthesis_ms: s2Local,
          stage3_slidesAndVerification_ms: s3Local,
          stage4_pptxCompilation_ms: s4Local,
          stageSum_ms: stageSumLocal,
          totalHttpDuration_ms: totalLocalHttpMs,
          stageSum_vs_total_diff_ms: totalLocalHttpMs - stageSumLocal,
        },
        perRequestCloudMode: {
          allowCloudFallback: true,
          httpStatus: cloudStatus,
          providerUsed: cloudProvider,
          stage1_transcriptIngestion_ms: s1Cloud,
          stage2_outlineSynthesis_ms: s2Cloud,
          stage3_slidesAndVerification_ms: s3Cloud,
          stage4_pptxCompilation_ms: s4Cloud,
          stageSum_ms: stageSumCloud,
          totalHttpDuration_ms: totalCloudHttpMs,
          stageSum_vs_total_diff_ms: totalCloudHttpMs - stageSumCloud,
        },
      },
      serverTimingLogs: timingLogs,
    };

    const evidenceResult = writeEvidence(
      'latency_measurement_run1.json',
      evidenceData,
      [
        'handlers/generate-ppt.ts',
        'core/synthesis/slide-planner.ts',
        'core/synthesis/bullet-verifier.ts',
        'core/transcript/chunk-translator.ts',
      ]
    );

    console.log(`\nEvidence written to ${evidenceResult.relativePath}`);
    console.log('Summary:');
    console.log(`  Local Batched: Total = ${totalLocalHttpMs}ms (Stages sum = ${stageSumLocal}ms, Provider = ${localProvider})`);
    console.log(`  Cloud Mode:    Total = ${totalCloudHttpMs}ms (Stages sum = ${stageSumCloud}ms, Provider = ${cloudProvider})`);
    process.exit(0);
  } finally {}
}

runMeasurement().catch(err => {
  console.error('Measurement failed:', err);
  process.exit(1);
});
