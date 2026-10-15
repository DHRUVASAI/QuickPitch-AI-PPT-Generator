import fs from 'node:fs';
import path from 'node:path';
import { extractTranscript } from '../core/transcript/extractor.js';
import { synthesizeOutline } from '../core/synthesis/outline-synthesizer.js';
import { compilePptx } from '../core/slides/pptx-compiler.js';
import { getModelClient } from '../models/index.js';
import { ChatMessage } from '../models/types.js';
import { validateSlideDeck, SlideItem } from '../core/schemas/slide.schema.js';

const VIDEO_URL = 'https://www.youtube.com/watch?v=qzAHXO-cN5Q';

async function runWarmLatency() {
  console.log('================================================================');
  console.log(' Warm-Run Latency Breakdown (Per-Stage Timings)');
  console.log('================================================================\n');

  const modelClient = getModelClient();

  // Stage 1: Transcript Ingestion (Warm run / Cached)
  const t0_transcript = Date.now();
  const transcriptData = await extractTranscript({
    sourceType: 'youtube',
    url: VIDEO_URL,
  }, {
    allowCloudFallback: false,
    outputLanguage: 'English',
    forceAudio: false,
    accuracyMode: false,
  });
  const t_transcript = Date.now() - t0_transcript;
  console.log(`[Stage 1: Transcript] Duration: ${t_transcript} ms (${(t_transcript/1000).toFixed(2)} s) - Title: "${transcriptData.title}"`);

  // Stage 2: Outline Synthesis (Warm run)
  const t0_outline = Date.now();
  const outline = await synthesizeOutline(transcriptData, modelClient, 'concise', {
    outputLanguage: 'English',
    allowCloudFallback: false,
  });
  const t_outline = Date.now() - t0_outline;
  console.log(`[Stage 2: Outline]    Duration: ${t_outline} ms (${(t_outline/1000).toFixed(2)} s) - Slides planned: ${outline.targetSlideCount}`);

  // Stage 3: Per-Slide Generation Timings
  console.log(`\n[Stage 3: Per-Slide Generation]`);
  const slideTimings: { slideIndex: number; title: string; durationMs: number }[] = [];
  const generatedSlides: SlideItem[] = [];

  for (let i = 0; i < outline.pillars.length; i++) {
    const pillar = outline.pillars[i];
    const t0_slide = Date.now();

    const prompt = `Generate a single slide JSON based on this section outline:
Section: ${pillar.name} (${pillar.description})
Transcript Context: ${transcriptData.sanitizedText.slice(0, 1500)}

Return strictly valid JSON:
{
  "title": "${pillar.name}",
  "subtitle": "Key insights and analysis",
  "category": "PILLAR 0${i + 1}",
  "layout_type": "cards",
  "cards": [
    { "card_title": "Finding", "points": ["Insight 1", "Insight 2"] }
  ]
}`;

    const res = await modelClient.complete([
      { role: 'user', content: prompt }
    ], {
      temperature: 0.2,
      maxTokens: 400,
      jsonMode: true,
    });

    const d_slide = Date.now() - t0_slide;
    slideTimings.push({ slideIndex: i + 1, title: pillar.name, durationMs: d_slide });
    console.log(`  Slide ${i + 1} ("${pillar.name}"): ${d_slide} ms (${(d_slide / 1000).toFixed(2)} s)`);

    try {
      const match = res.content.match(/\{[\s\S]*\}/);
      if (match) {
        generatedSlides.push(JSON.parse(match[0]));
      }
    } catch {}
  }

  // Ensure slides array meets schema
  const deck = validateSlideDeck({
    theme: 'cyber-blue',
    detailLevel: 'concise',
    slides: generatedSlides.length > 0 ? generatedSlides : [
      {
        title: outline.title,
        subtitle: 'Executive Summary',
        category: 'Overview',
        layout_type: 'cards',
        cards: [{ card_title: 'Key Takeaways', points: ['Point 1', 'Point 2'] }]
      }
    ]
  });

  // Stage 4: Compile PPTX
  const t0_compile = Date.now();
  const pptxRes = await compilePptx(deck, 'cyber-blue', transcriptData.sanitizedText);
  const t_compile = Date.now() - t0_compile;
  console.log(`\n[Stage 4: Compile]    Duration: ${t_compile} ms (${(t_compile/1000).toFixed(2)} s) - Size: ${pptxRes.buffer.length} bytes`);

  const totalTime = t_transcript + t_outline + slideTimings.reduce((acc, s) => acc + s.durationMs, 0) + t_compile;

  console.log('\n================================================================');
  console.log(' WARM-RUN TIMING BREAKDOWN TABLE');
  console.log('================================================================');
  console.table([
    { Stage: 'Transcript Ingestion (Cached)', 'Duration (ms)': t_transcript, 'Duration (s)': (t_transcript / 1000).toFixed(2) },
    { Stage: 'Outline Generation (LLM)', 'Duration (ms)': t_outline, 'Duration (s)': (t_outline / 1000).toFixed(2) },
    ...slideTimings.map(s => ({
      Stage: `Slide ${s.slideIndex}: ${s.title.slice(0, 25)}`,
      'Duration (ms)': s.durationMs,
      'Duration (s)': (s.durationMs / 1000).toFixed(2)
    })),
    { Stage: 'Compile PPTX', 'Duration (ms)': t_compile, 'Duration (s)': (t_compile / 1000).toFixed(2) },
    { Stage: 'TOTAL PIPELINE', 'Duration (ms)': totalTime, 'Duration (s)': (totalTime / 1000).toFixed(2) }
  ]);
}

runWarmLatency().catch(console.error);
