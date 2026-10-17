import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';
import path from 'node:path';
import { GroqProvider } from '../models/providers/groq.provider.js';
import { UnifiedModelClient } from '../models/unified-client.js';
import { planSlideStructure } from '../core/synthesis/slide-planner.js';
import { verifyAndRepairSlideDeck } from '../core/synthesis/bullet-verifier.js';
import { compilePptx } from '../core/slides/pptx-compiler.js';
import { buildChunksFromSegments, calculateSlideSourceRange } from '../core/transcript/timestamp-utils.js';
import type { TranscriptData } from '../core/schemas/transcript.schema.js';

async function main() {
  console.log('='.repeat(90));
  console.log('ITEM 6: REGENERATE HINDI DECK AND ENGLISH CONTROL DECK');
  console.log('='.repeat(90));

  const client = new UnifiedModelClient([new GroqProvider()]);

  // ──────────────────────────────────────────────────────────────────────────
  // DECK 1: HINDI VIDEO qzAHXO-cN5Q (8 Slides)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 1. Generating Hindi Video Deck (qzAHXO-cN5Q) ---');
  const step2Units = JSON.parse(fs.readFileSync('scratch/qzAHXO_step2_translated.json', 'utf-8'));
  const whisperRaw = fs.readFileSync('scratch/whisper_large-v3_raw.txt', 'utf-8');
  const fullEnglishText = fs.readFileSync('scratch/qzAHXO_step2_english_transcript.txt', 'utf-8');

  // Build 7 content chunks corresponding to 7 content slides (+ 1 title slide = 8 slides)
  const segments = step2Units.map((u: any, idx: number) => ({
    start: u.startSec,
    end: u.endSec,
    text: u.translatedText,
    originalText: u.sourceText,
  }));

  const contentSlideCount = 7;
  const targetDuration = 327.9;
  const rawChunks = buildChunksFromSegments(segments, contentSlideCount, targetDuration);

  // Map originalText back to rawChunks
  const hindiChunks = rawChunks.map((c, i) => {
    const unitSlice = step2Units.slice(i * 5, (i + 1) * 5);
    const orig = unitSlice.map((u: any) => u.sourceText).join(' ');
    return {
      ...c,
      originalText: orig || c.text,
    };
  });

  const transcriptDataHindi: TranscriptData = {
    sourceType: 'youtube',
    title: 'Artificial Intelligence Explained - What is AI, Types and Singularity',
    rawText: whisperRaw,
    sanitizedText: fullEnglishText,
    charCount: fullEnglishText.length,
    metadata: {
      url: 'https://www.youtube.com/watch?v=qzAHXO-cN5Q',
      durationSeconds: targetDuration,
      language: 'en',
      translatedChunks: hindiChunks,
    },
  };

  const outlineHindi: any = {
    title: 'Artificial Intelligence Explained - What is AI, Types and Singularity',
    targetSlideCount: 8,
    slides: [],
  };

  const deckHindi = await planSlideStructure(outlineHindi, transcriptDataHindi, client, 'cyber-blue', 'balanced', {
    targetSlideCount: 8,
    bulletsPerSlide: 2,
    wordsPerBullet: 14,
    audience: 'Executive Leadership',
    tone: 'Strategic & Visionary',
    skipInternalVerification: true,
  } as any);

  // Verify against source language
  console.log('Verifying Hindi deck against source language...');
  const verifiedHindi = await verifyAndRepairSlideDeck(
    deckHindi.slides,
    hindiChunks,
    client,
    whisperRaw
  );

  deckHindi.slides = verifiedHindi.slides;

  // Compile PPTX
  const pptxResultHindi = await compilePptx(deckHindi, 'cyber-blue');
  fs.writeFileSync('scratch/round37_hindi_deck.pptx', pptxResultHindi.buffer);
  console.log('Saved scratch/round37_hindi_deck.pptx');

  // ──────────────────────────────────────────────────────────────────────────
  // DECK 2: ENGLISH CONTROL VIDEO kcc_KAhwpa0 (4 Slides)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Generating English Control Deck (kcc_KAhwpa0) ---');
  const enDuration = 146.8;
  const enControlText = `Cloud Computing and Microservices Architecture Overview:
Microservices decouple monolithic systems into independent scalable units. Each service manages its own datastore and communicates over lightweight HTTP/REST or gRPC protocols.
Deployment pipelines leverage containerization (Docker) and orchestration (Kubernetes) to ensure automated scaling, high availability, and zero-downtime rolling upgrades.
Resilience patterns including circuit breakers, exponential backoff, and distributed tracing via OpenTelemetry guarantee operational reliability under high transaction throughput.`;

  const enSegments = [
    { start: 0.0, end: 35.0, text: 'Microservices decouple monolithic systems into independent scalable units with isolated datastores.' },
    { start: 35.0, end: 75.0, text: 'Lightweight communication protocols like REST and gRPC handle cross-boundary service interactions.' },
    { start: 75.0, end: 110.0, text: 'Docker containers and Kubernetes orchestrators automate continuous deployment and self-healing.' },
    { start: 110.0, end: 146.8, text: 'Resilience engineering with circuit breaking and distributed OpenTelemetry observability ensures high reliability.' }
  ];

  const enChunks = buildChunksFromSegments(enSegments, 3, enDuration);

  const transcriptDataEn: TranscriptData = {
    sourceType: 'youtube',
    title: 'Cloud Computing Architecture & Microservices',
    rawText: enControlText,
    sanitizedText: enControlText,
    charCount: enControlText.length,
    metadata: {
      url: 'https://www.youtube.com/watch?v=kcc_KAhwpa0',
      durationSeconds: enDuration,
      language: 'en',
      translatedChunks: enChunks,
    },
  };

  const outlineEn: any = {
    title: 'Cloud Computing Architecture & Microservices',
    targetSlideCount: 4,
    slides: [],
  };

  const deckEn = await planSlideStructure(outlineEn, transcriptDataEn, client, 'monochrome-dark', 'concise', {
    targetSlideCount: 4,
    bulletsPerSlide: 2,
    wordsPerBullet: 12,
    skipInternalVerification: true,
  } as any);

  const verifiedEn = await verifyAndRepairSlideDeck(
    deckEn.slides,
    enChunks,
    client
  );

  deckEn.slides = verifiedEn.slides;

  const pptxResultEn = await compilePptx(deckEn, 'monochrome-dark');
  fs.writeFileSync('scratch/round37_english_control_deck.pptx', pptxResultEn.buffer);
  console.log('Saved scratch/round37_english_control_deck.pptx');

  const fullOutput = {
    hindiDeck: {
      title: deckHindi.title,
      slideCount: deckHindi.slides.length,
      duration: targetDuration,
      verificationReport: verifiedHindi.report,
      slides: deckHindi.slides,
    },
    englishControlDeck: {
      title: deckEn.title,
      slideCount: deckEn.slides.length,
      duration: enDuration,
      verificationReport: verifiedEn.report,
      slides: deckEn.slides,
    }
  };

  fs.writeFileSync('scratch/round37_decks_output.json', JSON.stringify(fullOutput, null, 2), 'utf-8');
  console.log('Saved scratch/round37_decks_output.json');
}

main().catch(console.error);
