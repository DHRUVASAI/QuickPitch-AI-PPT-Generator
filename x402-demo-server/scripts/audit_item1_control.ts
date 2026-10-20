import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';
import path from 'node:path';
import { verifyQuote, formatVerifiedQuote } from '../core/utils/verify-quote.js';
import { buildChunksFromSegments } from '../core/transcript/timestamp-utils.js';
import { gradeBulletAgainstSource } from '../core/synthesis/bullet-verifier.js';
import { planSlideStructure } from '../core/synthesis/slide-planner.js';
import { GroqProvider } from '../models/providers/groq.provider.js';
import { UnifiedModelClient } from '../models/unified-client.js';

async function main() {
  console.log('='.repeat(90));
  console.log('ITEM 1: ENGLISH CONTROL VIDEO (kcc_KAhwpa0) AUDIT & REAL RE-RUN');
  console.log('='.repeat(90));

  const videoId = 'kcc_KAhwpa0';
  const videoTitle = 'The Mayans Ran Out of Stone, Not Time';
  const parsedCuesPath = path.join(process.cwd(), 'scratch', 'kcc_KAhwpa0_parsed_cues.json');
  const rawVttPath = path.join(process.cwd(), 'scratch', 'kcc_KAhwpa0.en.vtt');

  console.log(`\nVideo ID: ${videoId}`);
  console.log(`yt-dlp Official Title: "${videoTitle}"`);

  // Print first 15 transcript lines loaded
  const cues = JSON.parse(fs.readFileSync(parsedCuesPath, 'utf-8'));
  console.log(`\nFIRST 15 TRANSCRIPT LINES LOADED FOR CONTROL VIDEO (${videoId}):`);
  console.log('-'.repeat(90));

  for (let i = 0; i < 15; i++) {
    const c = cues[i];
    console.log(`Line ${String(i + 1).padStart(2)} [${c.start} --> ${c.end}]: "${c.text}"`);
    const v = verifyQuote(rawVttPath, c.text.slice(0, 30));
    console.log(`   ${formatVerifiedQuote(v)}`);
  }

  // Plain explanation of why the previous deck was about microservices
  console.log('\n' + '='.repeat(90));
  console.log('EXPLANATION: WHY THE PREVIOUS CONTROL DECK WAS ABOUT MICROSERVICES');
  console.log('='.repeat(90));
  console.log(`In Round 3.7 (and Round 3.6), \`scripts/regenerate_round37_decks.ts\` (lines 100-110)
hardcoded a mock placeholder string about "Cloud Computing and Microservices Architecture Overview"
instead of actually invoking yt-dlp / YouTube transcript extraction on video ID kcc_KAhwpa0.
As a result, the synthesizer generated slides about Docker, Kubernetes, and gRPC microservices,
completely unrelated to the actual video topic ("The Mayans Ran Out of Stone, Not Time" by CGP Grey).`);

  // Re-run with real transcript
  console.log('\n' + '='.repeat(90));
  console.log('RE-RUNNING DECK GENERATION WITH THE REAL MAYAN CALENDAR TRANSCRIPT');
  console.log('='.repeat(90));

  const duration = 146.8;
  const rawSegments = cues.map((c: any) => {
    const parseSec = (t: string) => {
      const [hh, mm, ss] = t.split(':');
      return parseFloat(hh) * 3600 + parseFloat(mm) * 60 + parseFloat(ss);
    };
    return {
      start: parseSec(c.start),
      end: parseSec(c.end),
      text: c.text,
    };
  });

  const fullCleanText = cues.map((c: any) => c.text).join(' ');
  const chunks = buildChunksFromSegments(rawSegments, 4, duration);

  const transcriptData: any = {
    sourceType: 'youtube',
    title: videoTitle,
    rawText: fullCleanText,
    sanitizedText: fullCleanText,
    charCount: fullCleanText.length,
    metadata: {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      durationSeconds: duration,
      language: 'en',
      translatedChunks: chunks,
      segments: rawSegments,
    },
  };

  const outline: any = {
    title: videoTitle,
    subtitle: 'Debunking the 2012 Doomsday Myth and Mayan Calendar Cycles',
    targetSlideCount: 4,
    slides: [],
  };

  const client = new UnifiedModelClient([new GroqProvider()]);
  console.log('Synthesizing 4-slide grounded presentation via Groq...');

  const deck = await planSlideStructure(outline, transcriptData, client, 'cyber-blue', 'concise', {
    targetSlideCount: 4,
    bulletsPerSlide: 2,
    wordsPerBullet: 14,
    skipInternalVerification: true,
  } as any);

  console.log(`\nGenerated ${deck.slides.length} slides for "${deck.title}". Grading each bullet against source segments...`);

  const auditedSlides = [];

  for (let sIdx = 0; sIdx < deck.slides.length; sIdx++) {
    const slide = deck.slides[sIdx];
    const chunk = chunks[sIdx] || chunks[chunks.length - 1];

    console.log(`\n--- Slide ${sIdx + 1}: ${slide.title} ---`);
    console.log(`Subtitle: ${slide.subtitle}`);
    console.log(`Category: ${slide.category} | Layout: ${slide.layout_type}`);
    console.log(`Speaker Notes: ${slide.speaker_notes}`);

    const slideAuditedBullets = [];

    for (const card of slide.cards) {
      console.log(`  Card: ${card.card_title}`);
      for (const bullet of card.points) {
        const audit = await gradeBulletAgainstSource(bullet, chunk, client);
        slideAuditedBullets.push(audit);
        const gradeBadge = audit.grade === 'SUPPORTED' ? '[SUPPORTED]' : `[${audit.grade}: UNVERIFIED]`;
        console.log(`    • ${gradeBadge} "${bullet}"`);
        console.log(`      Reason: ${audit.reason}`);
        console.log(`      Cited Source Segment (${chunk.timestamps}): "${chunk.text.slice(0, 60)}..."`);
        const v = verifyQuote(rawVttPath, chunk.text.slice(0, 30));
        console.log(`      Source Quote: ${formatVerifiedQuote(v)}`);
      }
    }

    // Dynamic slide range derived strictly from cited chunks
    const citedChunks = slideAuditedBullets.map(b => chunks.find(c => c.index === b.citedChunkIndex)).filter(Boolean);
    const minStart = citedChunks.length > 0 ? Math.min(...citedChunks.map((c: any) => c.startSec)) : chunk.startSec;
    const maxEnd = citedChunks.length > 0 ? Math.max(...citedChunks.map((c: any) => c.endSec)) : chunk.endSec;
    slide.source_start = minStart;
    slide.source_end = maxEnd;
    slide.source_timestamps = `${(minStart / 60 | 0).toString().padStart(2, '0')}:${Math.round(minStart % 60).toString().padStart(2, '0')} - ${(maxEnd / 60 | 0).toString().padStart(2, '0')}:${Math.round(maxEnd % 60).toString().padStart(2, '0')}`;

    console.log(`Dynamic Source Range: ${slide.source_timestamps} (${slide.source_start.toFixed(1)}s - ${slide.source_end.toFixed(1)}s)`);

    auditedSlides.push({
      slideIndex: sIdx + 1,
      title: slide.title,
      subtitle: slide.subtitle,
      source_timestamps: slide.source_timestamps,
      source_start: slide.source_start,
      source_end: slide.source_end,
      cards: slide.cards,
      bullets: slideAuditedBullets,
    });
  }

  // Save regenerated deck output
  const outPath = path.join(process.cwd(), 'scratch', 'round38_english_control_deck.json');
  fs.writeFileSync(outPath, JSON.stringify({ videoId, title: videoTitle, duration, slides: auditedSlides }, null, 2), 'utf-8');
  console.log(`\nSaved real control deck to ${outPath}`);
}

main().catch(console.error);
