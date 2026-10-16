import { config } from 'dotenv';
config();
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { LocalWhisperProvider } from '../models/providers/local-whisper.provider.js';

interface VramSample {
  second: number;
  timestamp: string;
  usedMb: number;
  freeMb: number;
  phase: string;
}

async function main() {
  console.log('=== Step 5: VRAM Unload & Reload Verification for large-v3 ===\n');

  const audioPath = path.join(process.cwd(), 'scratch', 'vram_test_clip.mp3');
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found at ${audioPath}`);
  }
  const audioBuffer = fs.readFileSync(audioPath);

  // 1. Ensure Ollama is loaded with Qwen 2.5 7B
  console.log('[Phase 1] Ensuring Ollama model (qwen2.5:7b) is loaded into GPU VRAM...');
  await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'qwen2.5:7b', prompt: 'Warm up call', stream: false }),
  });
  console.log('[Phase 1] Ollama is warm and loaded.');

  // 2. Set up per-second nvidia-smi sampler
  const samples: VramSample[] = [];
  let currentPhase = '1. Ollama loaded (baseline)';
  let secondCounter = 0;
  let keepSampling = true;

  function sampleVram(): { used: number; free: number } {
    try {
      const out = execSync('nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader,nounits', {
        encoding: 'utf-8',
        windowsHide: true,
      }).trim();
      const [used, free] = out.split(',').map(s => parseInt(s.trim(), 10));
      return { used, free };
    } catch {
      return { used: 0, free: 0 };
    }
  }

  const initial = sampleVram();
  console.log(`[Baseline VRAM] Used: ${initial.used} MB, Free: ${initial.free} MB`);

  const sampleInterval = setInterval(() => {
    if (!keepSampling) return;
    secondCounter++;
    const v = sampleVram();
    const now = new Date().toISOString().substring(11, 19);
    samples.push({
      second: secondCounter,
      timestamp: now,
      usedMb: v.used,
      freeMb: v.free,
      phase: currentPhase,
    });
  }, 1000);

  // Take first sample
  samples.push({
    second: 0,
    timestamp: new Date().toISOString().substring(11, 19),
    usedMb: initial.used,
    freeMb: initial.free,
    phase: currentPhase,
  });

  // Wait 2 seconds for baseline logging
  await new Promise(r => setTimeout(r, 2000));

  // 3. Trigger LocalWhisperProvider with model='large-v3'
  currentPhase = '2. Invoking large-v3 (Ollama unloading)';
  console.log(`\n[Phase 2] Calling LocalWhisperProvider.transcribeAudioDetailed with large-v3...`);
  const provider = new LocalWhisperProvider();

  const transcribePromise = provider.transcribeAudioDetailed(audioBuffer, 'vram_test_clip.mp3', 'audio/mpeg', {
    model: 'large-v3',
    unloadAfter: true,
  });

  // Track phase progress
  const timer1 = setTimeout(() => {
    currentPhase = '3. Whisper large-v3 active transcribing on CUDA';
  }, 2500);

  const res = await transcribePromise;
  clearTimeout(timer1);

  currentPhase = '4. Whisper unloaded, Ollama reloaded';
  console.log(`\n✓ Whisper large-v3 completed (${res.duration}s audio, text length: ${res.text.length})`);
  console.log(`[Text snippet]: "${res.text.slice(0, 80)}..."`);

  // Wait 3 seconds to record restored state
  await new Promise(r => setTimeout(r, 3000));

  keepSampling = false;
  clearInterval(sampleInterval);

  // 4. Print CSV and write to disk
  const csvLines = ['Second,Timestamp,Memory_Used_MB,Memory_Free_MB,Phase'];
  for (const s of samples) {
    csvLines.push(`${s.second},${s.timestamp},${s.usedMb},${s.freeMb},"${s.phase}"`);
  }

  const csvContent = csvLines.join('\n');
  const csvOutPath = path.join(process.cwd(), 'scratch', 'vram_large_v3_proof.csv');
  fs.writeFileSync(csvOutPath, csvContent, 'utf-8');

  console.log('\n================ PER-SECOND NVIDIA-SMI CSV OUTPUT ================');
  console.log(csvContent);
  console.log('==================================================================\n');
  console.log(`CSV proof saved to ${csvOutPath}`);
}

main().catch(err => {
  console.error('Error in VRAM proof script:', err);
  process.exit(1);
});
