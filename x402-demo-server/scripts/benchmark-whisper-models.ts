import fs from 'node:fs';
import path from 'node:path';
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { downloadYouTubeAudio } from '../core/transcript/audio-downloader.js';
import { getLocalWhisperClient } from '../models/index.js';

const execAsync = promisify(exec);
const VIDEO_URL = 'https://www.youtube.com/watch?v=qzAHXO-cN5Q';

function startVramSampler(): { getPeak: () => number; stop: () => number[] } {
  const samples: number[] = [];
  let peak = 0;
  const interval = setInterval(async () => {
    try {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits');
      const val = parseInt(stdout.trim(), 10);
      if (!isNaN(val)) {
        samples.push(val);
        if (val > peak) peak = val;
      }
    } catch {}
  }, 1000);

  return {
    getPeak: () => peak,
    stop: () => {
      clearInterval(interval);
      return samples;
    },
  };
}

async function run() {
  console.log('================================================================');
  console.log(' Benchmarking Faster-Whisper Models: small, medium, large-v3');
  console.log(` Target Video: ${VIDEO_URL} (Forced language: hi, task: transcribe)`);
  console.log('================================================================');

  // Verify sidecar health
  const healthResp = await fetch('http://127.0.0.1:8000/health');
  const health = await healthResp.json();
  console.log('Sidecar Health:', JSON.stringify(health));

  console.log('\n[1/4] Downloading audio track via yt-dlp once...');
  const audioDownload = await downloadYouTubeAudio(VIDEO_URL);
  const audioBuffer = await fs.promises.readFile(audioDownload.filePath);
  console.log(`✓ Audio ready: ${audioBuffer.length} bytes, duration: ${audioDownload.durationSeconds}s`);

  const models = ['small', 'medium', 'large-v3'];
  const results: any[] = [];
  const whisperClient = getLocalWhisperClient();

  for (const model of models) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Testing Model: "${model}" on CUDA (compute: ${model === 'large-v3' ? 'int8_float16' : 'float16'})`);
    console.log(`----------------------------------------------------------------`);

    // Reset model
    await whisperClient.unload().catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));

    const sampler = startVramSampler();
    const t0 = Date.now();

    console.log(`[Parameters Node -> Sidecar]:`);
    console.log(`  model:           ${model}`);
    console.log(`  language:        hi`);
    console.log(`  task:            transcribe`);
    console.log(`  vad_filter:      true`);

    try {
      const res = await whisperClient.transcribeAudioDetailed(
        audioBuffer,
        'audio.mp3',
        'audio/mpeg',
        {
          model,
          language: 'hi',
          task: 'transcribe',
          vadFilter: true,
          unloadAfter: false,
        }
      );

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const vramSamples = sampler.stop();
      const peakVram = sampler.getPeak();

      const devanagariCount = (res.text.match(/[\u0900-\u097F]+/g) || []).length;
      const latinCount = (res.text.match(/[a-zA-Z]+/g) || []).length;
      const scriptDetected = devanagariCount > latinCount ? 'Devanagari (Native Hindi)' : 'Latin / Romanized';

      const words = res.text.split(/\s+/).filter(Boolean);

      // Save raw text to scratch
      const outDir = path.resolve(process.cwd(), 'scratch');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, `whisper_${model}_raw.txt`), res.text, 'utf-8');

      // 10 line sample
      const sentences = res.text
        .split(/(?<=[.?!।])\s+|\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);

      const sample10 = sentences.slice(0, 10);

      results.push({
        model,
        timeSec: `${elapsed}s`,
        peakVramMiB: `${peakVram} MiB`,
        script: scriptDetected,
        devanagariWords: devanagariCount,
        latinWords: latinCount,
        wordCount: words.length,
        charCount: res.text.length,
        languageDetected: res.language,
        sample10,
        fullText: res.text,
      });

      console.log(`✓ Completed in ${elapsed}s`);
      console.log(`  Peak VRAM:        ${peakVram} MiB`);
      console.log(`  Output Script:    ${scriptDetected} (${devanagariCount} Devanagari words vs ${latinCount} Latin)`);
      console.log(`  Word Count:       ${words.length} words`);
      console.log(`  Sample (First 3 lines):`);
      sample10.slice(0, 3).forEach((line, i) => console.log(`    [Line ${i + 1}] ${line}`));
    } catch (err: any) {
      sampler.stop();
      console.error(`❌ Model ${model} failed:`, err.message);
      results.push({ model, error: err.message });
    } finally {
      await whisperClient.unload().catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  await audioDownload.cleanup();

  console.log('\n================================================================');
  console.log(' RAW COMPARISON TABLE ACROSS MODELS (qzAHXO-cN5Q, language=hi)');
  console.log('================================================================');
  console.table(
    results.map((r) => ({
      Model: r.model,
      Time: r.timeSec || 'Error',
      'Peak VRAM': r.peakVramMiB || 'N/A',
      Script: r.script || 'N/A',
      Devanagari: r.devanagariWords || 0,
      Latin: r.latinWords || 0,
      Words: r.wordCount || 0,
    }))
  );
}

run().catch(console.error);
