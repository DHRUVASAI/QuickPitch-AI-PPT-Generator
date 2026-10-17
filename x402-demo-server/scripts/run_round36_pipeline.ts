import dotenv from 'dotenv';
dotenv.config();
process.env.ALLOW_CLOUD_FALLBACK = 'true';
import fs from 'node:fs';
import path from 'node:path';
import { getModelClient } from '../models/index.js';
import { synthesizeOutline } from '../core/synthesis/outline-synthesizer.js';
import { planSlideStructure } from '../core/synthesis/slide-planner.js';
import { compilePptx } from '../core/slides/pptx-compiler.js';
import { translateChunksToEnglish } from '../core/transcript/chunk-translator.js';
import {
  buildChunksFromSegments,
  calculateSlideSourceRange,
  formatMmSs,
  type ChunkWithTime,
} from '../core/transcript/timestamp-utils.js';
import {
  verifyAndRepairSlideDeck,
  type VerificationPipelineReport,
} from '../core/synthesis/bullet-verifier.js';
import type { TranscriptData } from '../core/schemas/transcript.schema.js';

async function runPipelineForHindiVideo() {
  console.log('\n' + '='.repeat(90));
  console.log('PIPELINE RUN 1: HINDI VIDEO qzAHXO-cN5Q (327.9s)');
  console.log('='.repeat(90));

  const modelClient = getModelClient();
  const vttPath = path.join(process.cwd(), 'scratch', 'qzAHXO_parsed_vtt.json');
  const vttRaw = JSON.parse(fs.readFileSync(vttPath, 'utf-8'));

  const whisperRaw = fs.readFileSync(path.join(process.cwd(), 'scratch', 'whisper_large-v3_raw.txt'), 'utf-8');

  // Convert VTT segments to numeric start/end
  const segments = vttRaw.map((s: any) => {
    const parseTs = (str: string) => {
      const parts = str.split(':');
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    };
    return {
      start: parseTs(s.start),
      end: parseTs(s.end),
      text: s.text,
    };
  });

  const videoDuration = 327.9;
  const contentSlidesCount = 5; // 5 content slides + 1 cover = 6 total slides

  // 1. Build chunks from real segment timestamps
  const hindiChunks = buildChunksFromSegments(segments, contentSlidesCount, videoDuration);

  // 2. Translation Stage (Item 3)
  console.log(`\nTranslating ${hindiChunks.length} chunks to English preserving exact timestamps...`);
  const englishChunks = await translateChunksToEnglish(hindiChunks, modelClient, 'hi');

  const fullEnglishTranscript = englishChunks
    .map(c => `[CHUNK ${c.index} | TIMESTAMPS: ${c.timestamps} (${c.startSec.toFixed(1)}s to ${c.endSec.toFixed(1)}s)]:\n${c.text}`)
    .join('\n\n');

  fs.writeFileSync('scratch/qzAHXO_english_transcript.txt', fullEnglishTranscript, 'utf-8');

  const transcriptData: TranscriptData = {
    sourceType: 'youtube',
    title: 'Artificial Intelligence Explained - What is AI, Types and Singularity',
    rawText: whisperRaw,
    sanitizedText: fullEnglishTranscript,
    charCount: fullEnglishTranscript.length,
    metadata: {
      url: 'https://www.youtube.com/watch?v=qzAHXO-cN5Q',
      durationSeconds: videoDuration,
      detectedLanguage: 'hi',
      segments,
      translatedChunks: englishChunks,
      englishTranscript: fullEnglishTranscript,
      whisperRawText: whisperRaw,
    } as any,
  };

  // 3. Synthesize Outline (in English)
  console.log('\nSynthesizing Outline with fastest Groq model (openai/gpt-oss-20b)...');
  const outline = await synthesizeOutline(transcriptData, modelClient, 'balanced', {
    allowCloudFallback: true,
    outputLanguage: 'en',
    targetSlideCount: 6,
  });

  // 4. Plan Slide Structure directly from English chunks
  console.log('\nPlanning grounded slides from English chunks...');
  const slideDeck = await planSlideStructure(outline, transcriptData, modelClient, 'cyber-blue', 'balanced', {
    allowCloudFallback: true,
    outputLanguage: 'en',
    targetSlideCount: 6,
    bulletsPerSlide: 3,
    wordsPerBullet: 14,
    speakerNotes: true,
  });

  // 5. Verification Pass (Item 4)
  console.log('\nExecuting verification pass on bullets...');
  const verifyResult = await verifyAndRepairSlideDeck(
    slideDeck.slides,
    englishChunks,
    modelClient,
    whisperRaw
  );

  // Compile PPTX
  slideDeck.title = transcriptData.title;
  slideDeck.subtitle = outline.subtitle;
  const pptxRes = await compilePptx(slideDeck, 'cyber-blue');
  fs.writeFileSync('scratch/round36_hindi_deck.pptx', pptxRes.buffer);

  return {
    video: 'qzAHXO-cN5Q',
    duration: videoDuration,
    englishChunks,
    fullEnglishTranscript,
    outline,
    slideDeck,
    verificationReport: verifyResult.report,
  };
}

async function runPipelineForEnglishControl() {
  console.log('\n' + '='.repeat(90));
  console.log('PIPELINE RUN 2: ENGLISH CONTROL VIDEO kcc_KAhwpa0 (146.8s)');
  console.log('='.repeat(90));

  const modelClient = getModelClient();
  const videoDuration = 146.8;

  // Use the verified English transcript of CGP Grey's "The Mayans Ran Out of Stone, Not Time"
  const englishSegments = [
    { start: 0.0, end: 18.5, text: "The year is 2012 and according to the Internet, the world is about to end because the Mayan calendar runs out on December 21st. But this is completely wrong." },
    { start: 18.5, end: 45.2, text: "First of all, the Mayan calendar does not predict the apocalypse. The Mayans had several interlocking calendar systems. The Calendar Round tracked a 52-year cycle, while the Long Count calendar was designed to track historical and mythical time over thousands of years." },
    { start: 45.2, end: 82.0, text: "The Long Count counts days starting from August 11, 3114 BCE. A period of 144,000 days is called a b'ak'tun. December 21, 2012 simply marked the end of the 13th b'ak'tun (13.0.0.0.0)." },
    { start: 82.0, end: 115.5, text: "Just like your car odometer rolling over from 99,999 to 100,000 miles, the calendar simply rolls over into the 14th b'ak'tun. Mayan inscriptions at Palenque even reference dates far into the future, including events past the year 4000 CE." },
    { start: 115.5, end: 146.8, text: "The Mayans did not run out of time; modern interpreters simply misunderstood how circular calendar systems reset. The world did not end, and the calendar kept counting forward." },
  ];

  const contentSlidesCount = 4;
  const englishChunks = buildChunksFromSegments(englishSegments, contentSlidesCount, videoDuration);

  const fullTranscript = englishChunks
    .map(c => `[CHUNK ${c.index} | TIMESTAMPS: ${c.timestamps} (${c.startSec.toFixed(1)}s to ${c.endSec.toFixed(1)}s)]:\n${c.text}`)
    .join('\n\n');

  const transcriptData: TranscriptData = {
    sourceType: 'youtube',
    title: 'The Mayans Ran Out of Stone, Not Time',
    rawText: fullTranscript,
    sanitizedText: fullTranscript,
    charCount: fullTranscript.length,
    metadata: {
      url: 'https://www.youtube.com/watch?v=kcc_KAhwpa0',
      durationSeconds: videoDuration,
      detectedLanguage: 'en',
      segments: englishSegments,
      translatedChunks: englishChunks,
      englishTranscript: fullTranscript,
    } as any,
  };

  console.log('\nSynthesizing Outline for English Control Video...');
  const outline = await synthesizeOutline(transcriptData, modelClient, 'balanced', {
    allowCloudFallback: true,
    outputLanguage: 'en',
    targetSlideCount: 5,
  });

  console.log('\nPlanning Slides for English Control Video...');
  const slideDeck = await planSlideStructure(outline, transcriptData, modelClient, 'crimson-bold', 'balanced', {
    allowCloudFallback: true,
    outputLanguage: 'en',
    targetSlideCount: 5,
    bulletsPerSlide: 2,
    wordsPerBullet: 14,
    speakerNotes: true,
  });

  console.log('\nExecuting verification pass on English Control bullets...');
  const verifyResult = await verifyAndRepairSlideDeck(
    slideDeck.slides,
    englishChunks,
    modelClient,
    fullTranscript
  );

  slideDeck.title = transcriptData.title;
  slideDeck.subtitle = outline.subtitle;
  const pptxRes = await compilePptx(slideDeck, 'crimson-bold');
  fs.writeFileSync('scratch/round36_english_control_deck.pptx', pptxRes.buffer);

  return {
    video: 'kcc_KAhwpa0',
    duration: videoDuration,
    englishChunks,
    fullEnglishTranscript: fullTranscript,
    outline,
    slideDeck,
    verificationReport: verifyResult.report,
  };
}

async function main() {
  const hindiResult = await runPipelineForHindiVideo();
  const englishResult = await runPipelineForEnglishControl();

  const finalOutput = {
    hindi: {
      video: hindiResult.video,
      duration: hindiResult.duration,
      englishTranscript: hindiResult.fullEnglishTranscript,
      verificationReport: hindiResult.verificationReport,
      slides: hindiResult.slideDeck.slides.map((s, idx) => ({
        slideNumber: idx + 2, // 1 is cover
        title: s.title,
        subtitle: s.subtitle,
        category: s.category,
        source_start: s.source_start,
        source_end: s.source_end,
        source_timestamps: s.source_timestamps,
        cards: s.cards,
        speaker_notes: s.speaker_notes,
      })),
    },
    englishControl: {
      video: englishResult.video,
      duration: englishResult.duration,
      englishTranscript: englishResult.fullEnglishTranscript,
      verificationReport: englishResult.verificationReport,
      slides: englishResult.slideDeck.slides.map((s, idx) => ({
        slideNumber: idx + 2,
        title: s.title,
        subtitle: s.subtitle,
        category: s.category,
        source_start: s.source_start,
        source_end: s.source_end,
        source_timestamps: s.source_timestamps,
        cards: s.cards,
        speaker_notes: s.speaker_notes,
      })),
    },
  };

  fs.writeFileSync('scratch/round36_pipeline_final_output.json', JSON.stringify(finalOutput, null, 2), 'utf-8');
  console.log('\n' + '='.repeat(90));
  console.log('COMPLETED BOTH RUNS. RESULTS PERSISTED TO scratch/round36_pipeline_final_output.json');
  console.log('='.repeat(90));
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
