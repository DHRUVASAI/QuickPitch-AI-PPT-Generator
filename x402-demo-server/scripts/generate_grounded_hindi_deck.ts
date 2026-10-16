import { config } from 'dotenv';
config();
process.env.ALLOW_CLOUD_FALLBACK = 'true';
import fs from 'node:fs';
import path from 'node:path';
import { getModelClient } from '../models/index.js';
import { synthesizeOutline } from '../core/synthesis/outline-synthesizer.js';
import { planSlideStructure } from '../core/synthesis/slide-planner.js';
import { compilePptx } from '../core/slides/pptx-compiler.js';
import type { TranscriptData } from '../core/schemas/transcript.schema.js';

async function main() {
  console.log('================================================================================');
  console.log('REGENERATING HINDI DECK WITH STRICT CHUNK GROUNDING & VERIFICATION PASS');
  console.log('================================================================================\n');

  const vttSegmentsPath = path.join(process.cwd(), 'scratch', 'qzAHXO_parsed_vtt.json');
  if (!fs.existsSync(vttSegmentsPath)) {
    throw new Error('qzAHXO_parsed_vtt.json not found');
  }
  const segments: Array<{ start: string; end: string; text: string }> = JSON.parse(
    fs.readFileSync(vttSegmentsPath, 'utf-8')
  );

  const fullText = segments.map((s) => s.text).join(' ');
  const parseSec = (ts: string) => {
    const [h, m, rest] = ts.split(':');
    return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(rest);
  };

  const numSegments = segments.map((s) => ({
    start: parseSec(s.start),
    end: parseSec(s.end),
    text: s.text,
  }));

  const realVideoTitle = 'Artificial Intelligence Kya Hai? | What Is Artificial Intelligence In Hindi | Simplilearn';

  const transcript: TranscriptData = {
    sourceType: 'youtube',
    rawText: fullText,
    sanitizedText: fullText,
    charCount: fullText.length,
    title: realVideoTitle,
    metadata: {
      segments: numSegments,
      duration: 328,
    } as any,
  };

  const client = getModelClient();

  // 1. Synthesize Outline
  console.log('[Phase 1] Synthesizing presentation outline...');
  const outline = await synthesizeOutline(transcript, client, 'balanced', {
    allowCloudFallback: true,
    targetSlideCount: 6,
    audience: 'Executive Leadership',
    tone: 'Executive Strategic Briefing',
  });
  console.log(`✓ Outline synthesized: "${outline.title}" (${outline.providerUsed})\n`);

  // 2. Generate Slides with Chunk Grounding and Verification
  console.log('[Phase 2] Generating 6 slides with strict chunk grounding and verification...');
  const slideDeck = await planSlideStructure(outline, transcript, client, 'cyber-blue', 'balanced', {
    allowCloudFallback: true,
    targetSlideCount: 6,
    slideCount: 6,
    bulletsPerSlide: 3,
    wordsPerBullet: 14,
    speakerNotes: true,
  });
  console.log(`✓ SlideDeck produced with ${slideDeck.slides.length} content slides (${slideDeck.providerUsed})\n`);

  // 3. Compile to PPTX
  console.log('[Phase 3] Compiling presentation to PPTX with real title & source timestamps...');
  slideDeck.title = realVideoTitle;
  slideDeck.subtitle = outline.subtitle || 'Executive Intelligence Briefing & Strategic Synthesis';

  const pptxRes = await compilePptx(slideDeck, 'cyber-blue');
  const pptxPath = path.join(process.cwd(), 'scratch', 'grounded_hindi_deck.pptx');
  fs.writeFileSync(pptxPath, pptxRes.buffer);
  console.log(`✓ Saved PPTX to ${pptxPath} (${pptxRes.buffer.length} bytes)\n`);

  // 4. Output detailed verification report for slides 3 to 6
  console.log('================================================================================');
  console.log('GROUNDING & VERIFICATION REPORT FOR SLIDES 3 TO 6');
  console.log('================================================================================');

  // Slide index 0 is content slide 1 (overall slide 2 including cover)
  // Overall slides 3 to 6 correspond to content slides index 1 to 4
  const targetIndices = [1, 2, 3, 4]; // Slides 3, 4, 5, 6 in presentation

  for (const idx of targetIndices) {
    const s = slideDeck.slides[idx];
    if (!s) continue;
    const overallSlideNum = idx + 2; // +1 cover, +1 1-based
    console.log(`\n################### SLIDE ${overallSlideNum}: "${s.title}" ###################`);
    console.log(`Subtitle: "${s.subtitle}"`);
    console.log(`Category: [${s.category}] | Layout: [${s.layout_type}]`);
    console.log(`Source Chunk Timestamps: ${s.source_timestamps} (${s.source_start?.toFixed(1)}s to ${s.source_end?.toFixed(1)}s)`);

    if (s.unverified_terms && s.unverified_terms.length > 0) {
      console.log(`⚠️ Unverified Entities / Numbers Flagged (${s.unverified_terms.length}):`);
      s.unverified_terms.forEach((t) => console.log(`   - ${t}`));
    } else {
      console.log(`✓ Verification Pass: 100% of entities, numbers, and technical terms are grounded in source chunk.`);
    }

    console.log('\nCards & Bullets Grounding:');
    s.cards.forEach((c) => {
      console.log(`  [Card: "${c.card_title}"]`);
      c.points.forEach((p, pIdx) => {
        console.log(`    • Bullet ${pIdx + 1}: "${p}"`);
      });
    });

    if (s.speaker_notes) {
      console.log(`\n  Speaker Notes: "${s.speaker_notes}"`);
    }
  }

  // Save report
  fs.writeFileSync(
    'scratch/grounded_hindi_deck_report.json',
    JSON.stringify(
      {
        realVideoTitle,
        totalSlides: slideDeck.slides.length + 1,
        slides: slideDeck.slides,
      },
      null,
      2
    )
  );
}

main().catch(console.error);
