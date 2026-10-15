import fs from 'node:fs';
import path from 'node:path';
import { extractTranscript } from '../core/transcript/extractor.js';
import { synthesizeOutline } from '../core/synthesis/outline-synthesizer.js';
import { planSlideStructure } from '../core/synthesis/slide-planner.js';
import { compilePptx } from '../core/slides/pptx-compiler.js';
import { getModelClient } from '../models/index.js';

const VIDEO_URL = 'https://www.youtube.com/watch?v=qzAHXO-cN5Q';

async function runEndToEnd(outputLang: 'Hindi' | 'English') {
  console.log(`\n================================================================`);
  console.log(` End-to-End Deck Generation for "${outputLang}"`);
  console.log(` Video: ${VIDEO_URL}`);
  console.log(`================================================================`);

  const startTime = Date.now();
  const modelClient = getModelClient();

  // Stage 1: Extract transcript (uses transcript cache by video ID)
  console.log(`[Stage 1] Extracting transcript...`);
  const transcriptData = await extractTranscript({
    sourceType: 'youtube',
    url: VIDEO_URL,
  }, {
    allowCloudFallback: false,
    outputLanguage: outputLang,
    forceAudio: false,
    accuracyMode: true,
  });

  console.log(`✓ Transcript: "${transcriptData.title}" (${transcriptData.charCount} chars)`);

  // Stage 2: Synthesis with Qwen 2.5:7b
  console.log(`[Stage 2] Generating Outline in ${outputLang}...`);
  const outline = await synthesizeOutline(transcriptData, modelClient, 'balanced', {
    outputLanguage: outputLang,
    allowCloudFallback: false,
  });

  console.log(`✓ Outline: "${outline.title}" (${outline.targetSlideCount} slides planned)`);

  console.log(`[Stage 2] Generating Slides Deck in ${outputLang}...`);
  const deck = await planSlideStructure(outline, transcriptData, modelClient, 'neon-matrix', 'balanced', {
    outputLanguage: outputLang,
    allowCloudFallback: false,
  });

  console.log(`✓ Slide deck synthesized: ${deck.slides.length} slides`);

  // Stage 3: Compilation to PPTX
  console.log(`[Stage 3] Compiling PPTX with font styling...`);
  const pptxResult = await compilePptx(deck, 'neon-matrix', transcriptData.sanitizedText);

  const outDir = path.resolve(process.cwd(), 'scratch');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const fileName = `generated_${outputLang.toLowerCase()}_deck_${Date.now()}.pptx`;
  const filePath = path.join(outDir, fileName);
  fs.writeFileSync(filePath, pptxResult.buffer);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✓ Saved PPTX to: ${filePath} (${pptxResult.buffer.length} bytes, ${elapsed}s total)`);

  // Inspect font and Devanagari text
  const deckStr = JSON.stringify(deck);
  const devanagariMatches = deckStr.match(/[\u0900-\u097F]+/g) || [];
  const fontUsed = devanagariMatches.length > 0 ? 'Nirmala UI' : 'Trebuchet MS / Calibri';

  console.log(`\nDeck Summary (${outputLang}):`);
  console.log(`  Title:            ${outline.title}`);
  console.log(`  Slide Count:      ${deck.slides.length}`);
  console.log(`  Font Applied:     ${fontUsed}`);
  console.log(`  Devanagari Words: ${devanagariMatches.length}`);
  console.log(`  Sample Slides:`);
  deck.slides.slice(0, 3).forEach((s, idx) => {
    console.log(`    Slide ${idx + 1}: "${s.title}" (${s.cards.length} cards)`);
    if (s.cards[0]) {
      console.log(`      Card 1: "${s.cards[0].card_title}" -> ${s.cards[0].points.slice(0, 2).join(' | ')}`);
    }
  });

  return {
    outputLang,
    deck,
    filePath,
    fontUsed,
    devanagariCount: devanagariMatches.length,
    elapsed,
  };
}

async function main() {
  try {
    const hindiResult = await runEndToEnd('Hindi');
    const englishResult = await runEndToEnd('English');

    console.log(`\n================================================================`);
    console.log(` ALL END-TO-END GENERATIONS COMPLETE`);
    console.log(`================================================================`);
    console.log(`Hindi Deck:   ${hindiResult.filePath} (Devanagari: ${hindiResult.devanagariCount} words, Font: ${hindiResult.fontUsed})`);
    console.log(`English Deck: ${englishResult.filePath} (Font: ${englishResult.fontUsed})`);
  } catch (err: any) {
    console.error('Generation failed:', err);
    process.exit(1);
  }
}

main();
