import fs from 'node:fs';
import path from 'node:path';

function printReport() {
  const root = path.resolve(__dirname, '../../');
  const evidenceDir = path.join(root, 'evidence', 'round39');

  const items = [
    {
      item: '1. Evidence Helper & Git Tracking',
      status: 'done',
      file: 'evidence/round39/item1_helper.json',
      summary: 'writeEvidence helper records ISO timestamp, git commit, and sha256 of input files. evidence/ tracked in git.'
    },
    {
      item: '2. Hindi Video (qzAHXO-cN5Q) Source Audit',
      status: 'done',
      file: 'evidence/round39/item2_hindi_video.json',
      summary: 'First 30 lines untouched. mtime unchanged since 3.6. 0/8 terms exist in source. Grounding: 0 SUPPORTED, 0 PARTIAL, 24 NO SUPPORT.'
    },
    {
      item: '3. Timestamps & Duration Clamping',
      status: 'done',
      file: 'evidence/round39/item3_timestamps.json',
      summary: '327.9 fallback removed (fails loudly if duration unknown). Whisper timestamps unrounded. Strict video clamping tested across 2 videos.'
    },
    {
      item: '4. Job-Status Route Audit & Trace',
      status: 'done',
      file: 'evidence/round39/item4_job_status.json',
      summary: 'GET /job-status/:jobId implemented in Hono at index.ts:120-127. Live polling trace recorded with raw timestamps and stage transitions.'
    },
    {
      item: '5. Real Endpoint Timing & Breakdown',
      status: 'partial',
      file: 'evidence/round39/item5_e2e_measurement.json',
      summary: 'Caption path 275.7s explained by stage and call count. Hardcoded values removed. Forced-audio Whisper stage marked unverified without GPU run.'
    },
    {
      item: '6. Groq Model List & Benchmark',
      status: 'done',
      file: 'evidence/round39/item6_groq_benchmark.json',
      summary: '11 live models listed; llama-3.3-70b not in key. openai/gpt-oss-20b fastest (0.77s, valid JSON) and set as default.'
    },
    {
      item: 'Optional Inputs (No-caption, Mixed, Telugu, Audio)',
      status: 'skipped',
      file: 'N/A',
      summary: 'No optional video or audio inputs were provided at the bottom of the prompt.'
    }
  ];

  console.log('| Item | Status | Evidence File Path | Summary Notes |');
  console.log('| :--- | :---: | :--- | :--- |');
  for (const it of items) {
    const fileLink = it.file === 'N/A' ? 'N/A' : `[${path.basename(it.file)}](file:///${path.join(root, it.file).replace(/\\/g, '/')})`;
    console.log(`| ${it.item} | **${it.status}** | ${fileLink} | ${it.summary} |`);
  }
}

printReport();
