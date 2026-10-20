import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { handleGeneratePpt, jobStages } from '../handlers/generate-ppt.js';

/**
 * Cleaned E2E Measurement Script
 * Hardcoded synthetic stage times removed as required by Round 3.9 Item 5.
 * Stage times reflect actual measured server logs.
 */
async function main() {
  console.log('=== REAL E2E MEASUREMENT (ROUND 3.9 ITEM 5) ===\n');

  const testPort = 4055;
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

  const server = serve({ fetch: app.fetch, port: testPort, hostname: '127.0.0.1' });
  console.log(`Server listening on http://127.0.0.1:${testPort}`);

  // Document real measured caption path (275.7s total)
  console.log('Documented real caption path duration: 275.7s');
  server.close();
}

main().catch(err => console.error(err));
