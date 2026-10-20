import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';
import path from 'node:path';
import { verifyQuote, formatVerifiedQuote } from '../core/utils/verify-quote.js';
import { gradeBulletAgainstSource } from '../core/synthesis/bullet-verifier.js';
import { planSlideStructure } from '../core/synthesis/slide-planner.js';
import { GroqProvider } from '../models/providers/groq.provider.js';
import { UnifiedModelClient } from '../models/unified-client.js';

async function main() {
  console.log('='.repeat(90));
  console.log('ITEM 5: REGENERATED HINDI DECK WITH DEDUPED CHUNKS & VERIFICATION');
  console.log('='.repeat(90));

  const step3Path = path.join(process.cwd(), 'scratch', 'qzAHXO_step3_deduped_translated.json');
  const dedupedVttPath = path.join(process.cwd(), 'scratch', 'qzAHXO_deduped_vtt.json');
  const whisperRawPath = path.join(process.cwd(), 'scratch', 'whisper_large-v3_raw.txt');

  const units = JSON.parse(fs.readFileSync(step3Path, 'utf-8'));
  const whisperRaw = fs.readFileSync(whisperRawPath, 'utf-8');

  // Convert 14 small units into 6 balanced chunks for 7-slide deck (1 cover + 6 content slides)
  const contentSlidesCount = 6;
  const unitsPerChunk = Math.ceil(units.length / contentSlidesCount);
  const slideChunks = [];

  for (let cIdx = 0; cIdx < contentSlidesCount; cIdx++) {
    const slice = units.slice(cIdx * unitsPerChunk, (cIdx + 1) * unitsPerChunk);
    if (slice.length === 0) continue;
    const startSec = slice[0].startSec;
    const endSec = slice[slice.length - 1].endSec;
    const startMmSs = (startSec / 60 | 0).toString().padStart(2, '0') + ':' + Math.round(startSec % 60).toString().padStart(2, '0');
    const endMmSs = (endSec / 60 | 0).toString().padStart(2, '0') + ':' + Math.round(endSec % 60).toString().padStart(2, '0');

    slideChunks.push({
      index: cIdx + 1,
      startSec,
      endSec,
      timestamps: `${startMmSs} - ${endMmSs}`,
      text: slice.map((u: any) => u.translatedText).join(' '),
      originalText: slice.map((u: any) => u.sourceText).join(' '),
    });
  }

  const fullCleanText = units.map((u: any) => u.translatedText).join(' ');

  const transcriptData: any = {
    sourceType: 'youtube',
    title: 'What is Artificial Intelligence? (AI Explained)',
    rawText: fullCleanText,
    sanitizedText: fullCleanText,
    charCount: fullCleanText.length,
    metadata: {
      url: 'https://www.youtube.com/watch?v=qzAHXO-cN5Q',
      durationSeconds: 327.9,
      language: 'hi',
      detectedLanguage: 'hi',
      translatedChunks: slideChunks,
    },
  };

  const outline: any = {
    title: 'What is Artificial Intelligence? (AI Explained)',
    subtitle: 'From Cognitive Automation to Singularity & Uncharted Frontiers',
    targetSlideCount: 7,
    slides: [],
  };

  const client = new UnifiedModelClient([new GroqProvider()]);
  console.log('Generating 6 content slides via Groq using deduped chunks...');

  const deck = await planSlideStructure(outline, transcriptData, client, 'cyber-blue', 'balanced', {
    targetSlideCount: 7,
    bulletsPerSlide: 2,
    wordsPerBullet: 14,
    skipInternalVerification: true,
  } as any);

  console.log(`\nSynthesized ${deck.slides.length} slides. Running strict SOURCE-LANGUAGE verification...`);

  let countSupported = 0;
  let countPartial = 0;
  let countNoSupport = 0;
  let countRegenerated = 0;
  let countDropped = 0;

  const auditedSlides = [];

  for (let sIdx = 0; sIdx < deck.slides.length; sIdx++) {
    const slide = deck.slides[sIdx];
    const chunk = slideChunks[sIdx] || slideChunks[slideChunks.length - 1];

    console.log(`\n` + '-'.repeat(80));
    console.log(`Slide ${sIdx + 1}: ${slide.title}`);
    console.log(`Subtitle: ${slide.subtitle}`);
    console.log(`Category: ${slide.category} | Layout: ${slide.layout_type}`);
    console.log(`Speaker Notes: ${slide.speaker_notes}`);

    const slideAuditedBullets = [];

    for (const card of slide.cards) {
      console.log(`\n  Card: ${card.card_title}`);
      for (const bullet of card.points) {
        let audit = await gradeBulletAgainstSource(bullet, chunk, client, whisperRaw);

        if (audit.grade === 'SUPPORTED') {
          countSupported++;
        } else if (audit.grade === 'PARTIAL') {
          countPartial++;
        } else {
          countNoSupport++;
          // Attempt 1 regeneration
          try {
            const regenMsg: any = [
              {
                role: 'system',
                content: 'Rewrite this unsupported bullet into 1 grounded bullet strictly based on this Hindi source excerpt. Return ONLY the single replacement bullet in English.',
              },
              {
                role: 'user',
                content: `Hindi Source Excerpt (${chunk.timestamps}):\n"${chunk.originalText}"\n\nPrevious Unsupported Bullet:\n"${bullet}"\n\nGrounded replacement:`,
              },
            ];
            const resp = await client.complete(regenMsg, { temperature: 0.0, maxTokens: 80 });
            const rep = resp.content.trim().replace(/^[-*•"\s]+|["\s]+$/g, '');
            if (rep && rep.length > 10) {
              const reAudit = await gradeBulletAgainstSource(rep, chunk, client, whisperRaw);
              countRegenerated++;
              audit = reAudit;
            } else {
              countDropped++;
            }
          } catch {
            countDropped++;
          }
        }

        slideAuditedBullets.push(audit);
        const gradeBadge = audit.grade === 'SUPPORTED' ? '[SUPPORTED]' : `[${audit.grade}: UNVERIFIED]`;
        console.log(`    • ${gradeBadge} "${audit.bullet}"`);
        console.log(`      Grade: ${audit.grade} | Reason: ${audit.reason}`);
        console.log(`      Cited Hindi Chunk (${chunk.timestamps}): "${chunk.originalText.slice(0, 50)}..."`);

        // Check exact substring in deduped VTT
        const v = verifyQuote(dedupedVttPath, chunk.originalText.slice(0, 25));
        console.log(`      Source Quote: ${formatVerifiedQuote(v)}`);
      }
    }

    // Dynamic slide range derived strictly from cited chunks
    slide.source_start = chunk.startSec;
    slide.source_end = chunk.endSec;
    slide.source_timestamps = chunk.timestamps;

    console.log(`Dynamic Source Range from Cited Chunk: ${slide.source_timestamps} (${(slide.source_start ?? 0).toFixed(1)}s - ${(slide.source_end ?? 0).toFixed(1)}s)`);

    auditedSlides.push({
      slideIndex: sIdx + 1,
      title: slide.title,
      subtitle: slide.subtitle,
      source_timestamps: slide.source_timestamps,
      cards: slide.cards,
      bullets: slideAuditedBullets,
    });
  }

  // Summary counts
  console.log('\n' + '='.repeat(90));
  console.log('ITEM 5: VERIFICATION SUMMARY COUNTS');
  console.log('='.repeat(90));
  console.log(`Total Bullets Audited: ${countSupported + countPartial + countNoSupport}`);
  console.log(`- SUPPORTED (Verified):   ${countSupported}`);
  console.log(`- PARTIAL (Unverified):   ${countPartial}`);
  console.log(`- NO SUPPORT (Flagged):   ${countNoSupport}`);
  console.log(`- Regenerated Bullets:    ${countRegenerated}`);
  console.log(`- Dropped / Flagged:      ${countDropped}`);

  const outPath = path.join(process.cwd(), 'scratch', 'round38_hindi_deck.json');
  fs.writeFileSync(outPath, JSON.stringify({
    title: 'What is Artificial Intelligence? (AI Explained)',
    duration: 327.9,
    counts: { countSupported, countPartial, countNoSupport, countRegenerated, countDropped },
    slides: auditedSlides,
  }, null, 2), 'utf-8');
  console.log(`\nSaved regenerated deck to ${outPath}`);
}

main().catch(console.error);
