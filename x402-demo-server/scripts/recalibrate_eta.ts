import { config } from 'dotenv';
config();
process.env.ALLOW_CLOUD_FALLBACK = 'true';
import fs from 'node:fs';
import path from 'node:path';
import { getModelClient, getLocalWhisperClient } from '../models/index.js';
import { synthesizeOutline } from '../core/synthesis/outline-synthesizer.js';
import { planSlideStructure } from '../core/synthesis/slide-planner.js';
import { compilePptx } from '../core/slides/pptx-compiler.js';
import type { TranscriptData } from '../core/schemas/transcript.schema.js';

async function measureRun(targetSlideCount: number, audioBuffer: Buffer, audioName: string) {
  console.log(`\n================================================================================`);
  console.log(`MEASURING END-TO-END PIPELINE: TARGET = ${targetSlideCount} SLIDES`);
  console.log(`================================================================================`);

  const tStart = performance.now();

  // 1. Transcription
  console.log(`[Stage 1: Transcription] Transcribing audio with Local Whisper...`);
  const tTrans0 = performance.now();
  const whisperClient = getLocalWhisperClient();
  const transResult = await whisperClient.transcribeAudioDetailed(audioBuffer, audioName, 'audio/mpeg', {
    model: 'small',
    unloadAfter: false,
  });
  const tTrans1 = performance.now();
  const transTime = (tTrans1 - tTrans0) / 1000;
  console.log(`✓ Transcribed in ${transTime.toFixed(2)}s (${transResult.segments?.length || 0} segments, ${transResult.text.length} chars)`);

  const transcript: TranscriptData = {
    sourceType: 'audio',
    rawText: transResult.text,
    sanitizedText: transResult.text,
    charCount: transResult.text.length,
    title: 'Steve Jobs 2005 Stanford Commencement Address',
    metadata: {
      segments: transResult.segments || [],
      duration: transResult.duration || 328,
    } as any,
  };

  const modelClient = getModelClient();

  // 2. Outline Synthesis
  console.log(`[Stage 2: Outline Synthesis] Generating strategic outline...`);
  const tOut0 = performance.now();
  const outline = await synthesizeOutline(transcript, modelClient, 'balanced', {
    allowCloudFallback: true,
    targetSlideCount,
    audience: 'Executive Leadership',
    tone: 'Executive Investor Pitch',
  });
  const tOut1 = performance.now();
  const outlineTime = (tOut1 - tOut0) / 1000;
  console.log(`✓ Outline synthesized in ${outlineTime.toFixed(2)}s (Provider: ${outline.providerUsed})`);

  // 3. Slide Planning
  console.log(`[Stage 3: Slide Planning] Planning ${targetSlideCount} slides...`);
  const tSlide0 = performance.now();
  const slideDeck = await planSlideStructure(outline, transcript, modelClient, 'cyber-blue', 'balanced', {
    allowCloudFallback: true,
    targetSlideCount,
    slideCount: targetSlideCount,
    bulletsPerSlide: 3,
    wordsPerBullet: 14,
    speakerNotes: true,
  });
  const tSlide1 = performance.now();
  const slideTime = (tSlide1 - tSlide0) / 1000;
  console.log(`✓ Slide planning completed in ${slideTime.toFixed(2)}s (${slideDeck.slides.length} content slides)`);

  // 4. PPTX Compilation
  console.log(`[Stage 4: PPTX Compilation] Compiling PowerPoint file...`);
  const tComp0 = performance.now();
  slideDeck.title = transcript.title;
  slideDeck.subtitle = outline.subtitle;
  const pptxRes = await compilePptx(slideDeck, 'cyber-blue');
  const tComp1 = performance.now();
  const compTime = (tComp1 - tComp0) / 1000;
  console.log(`✓ Compiled PPTX in ${compTime.toFixed(2)}s (${pptxRes.buffer.length} bytes)`);

  const tEnd = performance.now();
  const totalTime = (tEnd - tStart) / 1000;

  console.log(`\n>>> TOTAL END-TO-END LATENCY FOR ${targetSlideCount} SLIDES: ${totalTime.toFixed(2)}s <<<`);

  return {
    targetSlideCount,
    actualSlides: slideDeck.slides.length + 1, // +1 cover
    transcriptionTimeSec: round2(transTime),
    outlineTimeSec: round2(outlineTime),
    slidePlanningTimeSec: round2(slideTime),
    compilationTimeSec: round2(compTime),
    totalTimeSec: round2(totalTime),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function main() {
  const audioPath = path.join(process.cwd(), 'scratch', 'bench_audio_en.mp3');
  const audioBuffer = fs.readFileSync(audioPath);

  const results = [];
  results.push(await measureRun(4, audioBuffer, 'bench_audio_en.mp3'));
  results.push(await measureRun(8, audioBuffer, 'bench_audio_en.mp3'));
  results.push(await measureRun(12, audioBuffer, 'bench_audio_en.mp3'));

  console.log('\n================================================================================');
  console.log('ETA RECALIBRATION SUMMARY (3 MEASURED RUNS)');
  console.log('================================================================================');
  console.table(results);

  fs.writeFileSync('scratch/eta_recalibration_results.json', JSON.stringify(results, null, 2));
  console.log('Saved to scratch/eta_recalibration_results.json');
}

main().catch(console.error);
