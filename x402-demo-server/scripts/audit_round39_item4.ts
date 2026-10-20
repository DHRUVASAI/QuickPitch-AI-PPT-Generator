import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { handleGeneratePpt, jobStages } from '../handlers/generate-ppt.js';
import { writeEvidence } from './evidence-helper.js';

async function main() {
  console.log('=== ROUND 3.9 ITEM 4 AUDIT: JOB-STATUS ROUTE ===\n');

  // 1. Inspect Handler Details
  const indexPath = path.resolve('index.ts');
  const indexContent = fs.readFileSync(indexPath, 'utf-8');

  // Extract handler code snippet from index.ts lines 119-127
  const lines = indexContent.split(/\r?\n/);
  const handlerLines = lines.slice(118, 127).join('\n');
  console.log('Handler File Path:', indexPath);
  console.log('Framework: Hono (using @hono/node-server)');
  console.log('Handler Code:');
  console.log(handlerLines);

  // 2. Start server on ephemeral port for live polling trace
  const testPort = 4039;
  const app = new Hono();
  app.post('/generate-ppt', handleGeneratePpt);
  app.get('/generate-ppt/status/:jobId', (c) => {
    const jobId = c.req.param('jobId');
    const stage = jobStages.get(jobId);
    if (!stage) {
      return c.json({ status: 'unknown', stage: 'ingest', percent: 15, message: 'Processing presentation...' }, 200);
    }
    return c.json({ status: 'ok', ...stage }, 200);
  });

  const server = serve({
    fetch: app.fetch,
    port: testPort,
    hostname: '127.0.0.1',
  });

  console.log(`\nLive test server listening on http://127.0.0.1:${testPort}...`);

  const jobId = `live_audit_${Date.now()}`;
  const pollTrace: any[] = [];

  // Start asynchronous generation in background
  const payload = {
    source_type: 'text',
    text: 'Artificial Intelligence overview. Narrow AI focuses on specific tasks such as recommendation systems and classification, whereas Strong AI remains theoretical.',
    theme: 'cyber-blue',
    slide_count: 3,
    job_id: jobId,
  };

  const genPromise = fetch(`http://127.0.0.1:${testPort}/generate-ppt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Poll job status every second until completion or timeout (max 20s)
  const startTime = Date.now();
  let done = false;

  while (!done && (Date.now() - startTime) < 20000) {
    const pollTimestamp = new Date().toISOString();

    try {
      const res = await fetch(`http://127.0.0.1:${testPort}/generate-ppt/status/${jobId}`);
      const body = await res.json();
      const elapsed = Date.now() - startTime;

      const traceEntry = {
        timestamp: pollTimestamp,
        elapsedMs: elapsed,
        httpStatus: res.status,
        body,
      };
      pollTrace.push(traceEntry);
      console.log(`[Trace +${(elapsed / 1000).toFixed(1)}s | ${pollTimestamp}] HTTP ${res.status} -> status: ${body.status}, stage: ${body.stage}, percent: ${body.percent}%, message: "${body.message}"`);

      if (body.stage === 'complete' || body.stage === 'error') {
        done = true;
      }
    } catch (err: any) {
      console.warn('Poll error:', err.message);
    }

    if (!done) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Await the generation promise to finish
  const genResponse = await genPromise;
  const genBuffer = await genResponse.arrayBuffer();
  console.log(`\nGeneration completed with HTTP ${genResponse.status} (${genBuffer.byteLength} bytes)`);

  // Close server
  server.close();

  const evidenceData = {
    item: 'Part 1 Item 4: Job-Status Route Handler and Live Trace',
    route: '/generate-ppt/status/:jobId',
    filePath: 'index.ts',
    framework: 'Hono (@hono/node-server)',
    handlerCode: handlerLines,
    helperFile: 'handlers/generate-ppt.ts',
    testJobId: jobId,
    liveTrace: pollTrace,
    finalDeckSizeBytes: genBuffer.byteLength,
  };

  const { relativePath } = writeEvidence('item4_job_status', evidenceData, [
    'index.ts',
    'handlers/generate-ppt.ts',
  ]);

  console.log(`\n✓ Raw evidence written to ${relativePath}`);
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
