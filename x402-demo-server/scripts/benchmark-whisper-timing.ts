import { config } from 'dotenv';
config();
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

async function main() {
  console.log('=== Step 6: Whisper Timing Breakdown on Hindi Audio (qzAHXO-cN5Q) ===\n');

  const audioPath = path.join(process.cwd(), 'scratch', 'bench_audio_hi.webm');
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const audioBuffer = fs.readFileSync(audioPath);
  const fileSizeMb = (audioBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(`Audio file: bench_audio_hi.webm (${fileSizeMb} MB)`);

  // Measure audio duration using ffprobe
  let audioDurationSec = 328.0;
  try {
    const probe = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`, { encoding: 'utf-8' }).trim();
    if (probe && !isNaN(parseFloat(probe))) {
      audioDurationSec = parseFloat(probe);
    }
  } catch {}
  console.log(`Audio duration: ${audioDurationSec.toFixed(1)} seconds`);

  // 1. Measure standalone audio decode via ffmpeg
  console.log('\n[Phase 1] Measuring ffmpeg audio decode to 16kHz float32...');
  const tDecodeStart = performance.now();
  const decodedRaw = execSync(`ffmpeg -nostdin -threads 0 -v error -i "${audioPath}" -f f32le -ac 1 -ar 16000 -`, {
    maxBuffer: 100 * 1024 * 1024,
  });
  const tDecodeEnd = performance.now();
  const decodeDurationSec = (tDecodeEnd - tDecodeStart) / 1000;
  const decodedSamples = decodedRaw.length / 4;
  console.log(`✓ Audio decode completed in ${decodeDurationSec.toFixed(3)}s (${decodedSamples} samples, ${(decodedSamples / 16000).toFixed(1)}s audio)`);

  // 2. Ensure model is unloaded to measure model load
  console.log('\n[Phase 2] Unloading sidecar model to ensure cold load...');
  await fetch('http://127.0.0.1:8000/unload', { method: 'POST' });

  // 3. Measure model load & inference via Python sidecar
  console.log('\n[Phase 3] Sending 328s Hindi audio to sidecar for model=small, language=hi...');
  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' }), 'bench_audio_hi.webm');
  formData.append('model', 'small');
  formData.append('language', 'hi');
  formData.append('task', 'transcribe');
  formData.append('vad_filter', 'true');

  const tTotalStart = performance.now();
  const resp = await fetch('http://127.0.0.1:8000/v1/audio/transcriptions', {
    method: 'POST',
    body: formData,
  });
  const tTotalEnd = performance.now();

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Sidecar transcription failed (${resp.status}): ${errText}`);
  }

  const data: any = await resp.json();
  const totalDurationSec = (tTotalEnd - tTotalStart) / 1000;

  // Let's also measure warm inference time on a second run (model already loaded)
  console.log('\n[Phase 4] Measuring warm inference (model already loaded in memory)...');
  const tWarmStart = performance.now();
  const warmResp = await fetch('http://127.0.0.1:8000/v1/audio/transcriptions', {
    method: 'POST',
    body: formData,
  });
  const tWarmEnd = performance.now();
  const warmDurationSec = (tWarmEnd - tWarmStart) / 1000;

  const modelLoadEst = Math.max(0.5, totalDurationSec - warmDurationSec);
  const pureInferenceEst = warmDurationSec - decodeDurationSec;

  const rtf = warmDurationSec / audioDurationSec;

  console.log('\n================ WHISPER TIMING BREAKDOWN ================');
  console.log(`Audio File:            bench_audio_hi.webm (Hindi, qzAHXO-cN5Q)`);
  console.log(`Audio Duration:        ${audioDurationSec.toFixed(1)}s (~5.5 minutes)`);
  console.log(`Whisper Model:         small (faster-whisper, CUDA float16)`);
  console.log(`Cold Total Time:       ${totalDurationSec.toFixed(2)}s`);
  console.log(`Warm Total Time:       ${warmDurationSec.toFixed(2)}s`);
  console.log(`----------------------------------------------------------`);
  console.log(`Breakdown (Warm Request):`);
  console.log(`  1. Audio Decode (ffmpeg):     ${decodeDurationSec.toFixed(2)}s (${((decodeDurationSec / warmDurationSec) * 100).toFixed(1)}%)`);
  console.log(`  2. Model Load (cold only):    ${modelLoadEst.toFixed(2)}s`);
  console.log(`  3. Inference (Faster-Whisper): ${pureInferenceEst.toFixed(2)}s (${((pureInferenceEst / warmDurationSec) * 100).toFixed(1)}%)`);
  console.log(`  Real-Time Factor (RTF):       ${rtf.toFixed(2)}x (1 second of audio takes ${(rtf).toFixed(2)}s to transcribe)`);
  console.log(`==========================================================\n`);

  // Write results to scratch
  const report = {
    audio_duration_sec: audioDurationSec,
    cold_total_sec: totalDurationSec,
    warm_total_sec: warmDurationSec,
    audio_decode_sec: decodeDurationSec,
    model_load_sec: modelLoadEst,
    inference_sec: pureInferenceEst,
    rtf,
    segments_count: data.segments?.length || 0,
    text_length: data.text?.length || 0,
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'scratch', 'whisper_timing_breakdown.json'),
    JSON.stringify(report, null, 2)
  );
}

main().catch(err => {
  console.error('Timing test error:', err);
  process.exit(1);
});
