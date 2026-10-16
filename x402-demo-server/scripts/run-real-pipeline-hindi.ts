import { config } from 'dotenv';
config();
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('=== Step 3: Generating English Deck through the REAL Pipeline ===\n');
  console.log('Target Video: https://www.youtube.com/watch?v=qzAHXO-cN5Q (Hindi Video)');
  console.log('Endpoint: POST http://localhost:4021/generate-ppt\n');

  const payload = {
    source_type: 'youtube',
    url: 'https://www.youtube.com/watch?v=qzAHXO-cN5Q',
    slide_count: 6,
    theme: 'cyber-blue',
    detail_level: 'balanced',
    audience: 'Executive Leadership & Product Strategists',
    tone: 'Strategic & Visionary',
    speaker_notes: true,
    agenda: true,
    summary: true,
  };

  const tStart = performance.now();
  console.log('Sending request to live server...');
  const res = await fetch('http://localhost:4021/generate-ppt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const tEnd = performance.now();
  const elapsedSec = ((tEnd - tStart) / 1000).toFixed(2);

  console.log(`\nResponse Status: ${res.status} ${res.statusText} (${elapsedSec}s)`);
  console.log('Headers:');
  const headersObj: Record<string, string> = {};
  res.headers.forEach((val, key) => {
    if (key.startsWith('x-quickpitch') || key === 'content-disposition' || key === 'content-type') {
      headersObj[key] = val;
      console.log(`  ${key}: ${val}`);
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Real pipeline failed with status ${res.status}: ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const outPath = path.join(process.cwd(), 'scratch', 'real_pipeline_hindi_deck.pptx');
  fs.writeFileSync(outPath, buffer);
  console.log(`\n✓ Successfully saved PPTX (${buffer.length} bytes) to: ${outPath}`);

  // Load the Hindi source text to check against
  const sourcePath = path.join(process.cwd(), 'scratch', 'qzAHXO-cN5Q_captions_clean.txt');
  let sourceText = '';
  if (fs.existsSync(sourcePath)) {
    sourceText = fs.readFileSync(sourcePath, 'utf-8');
    console.log(`✓ Loaded full Hindi source text: ${sourceText.length} characters (Full transcript, not truncated to 2500)`);
  }
}

main().catch(err => {
  console.error('Real pipeline test failed:', err);
  process.exit(1);
});
