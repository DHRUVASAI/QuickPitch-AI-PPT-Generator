import fs from 'node:fs';
import { formatVerifiedQuote } from '../core/utils/verify-quote.js';

function main() {
  const filePath = 'scratch/round37_decks_output.json';
  if (!fs.existsSync(filePath)) {
    console.error(`File ${filePath} not found!`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log('='.repeat(90));
  console.log('ITEM 6: REGENERATED HINDI DECK (qzAHXO-cN5Q)');
  console.log('='.repeat(90));
  console.log(`Title: ${data.hindiDeck.title}`);
  console.log(`Total Slides: ${data.hindiDeck.slideCount} | Video Duration: ${data.hindiDeck.duration}s\n`);

  data.hindiDeck.slides.forEach((s: any, idx: number) => {
    console.log(`--- Slide ${idx + 1}: ${s.title} ---`);
    console.log(`Subtitle: ${s.subtitle}`);
    console.log(`Category: ${s.category} | Layout: ${s.layout_type}`);
    console.log(`Source Range: ${s.source_timestamps} (${s.source_start?.toFixed(1)}s - ${s.source_end?.toFixed(1)}s)`);
    console.log(`Speaker Notes: ${s.speaker_notes}`);
    console.log('Cards:');
    (s.cards || []).forEach((c: any, cIdx: number) => {
      console.log(`  Card ${cIdx + 1}: ${c.card_title}`);
      (c.points || []).forEach((pt: string) => {
        console.log(`    • ${pt}`);
      });
    });
    console.log('');
  });

  console.log('='.repeat(90));
  console.log('ITEM 6: FULL ENGLISH CONTROL DECK (kcc_KAhwpa0)');
  console.log('='.repeat(90));
  console.log(`Title: ${data.englishControlDeck.title}`);
  console.log(`Total Slides: ${data.englishControlDeck.slideCount} | Video Duration: ${data.englishControlDeck.duration}s\n`);

  data.englishControlDeck.slides.forEach((s: any, idx: number) => {
    console.log(`--- Slide ${idx + 1}: ${s.title} ---`);
    console.log(`Subtitle: ${s.subtitle}`);
    console.log(`Category: ${s.category} | Layout: ${s.layout_type}`);
    console.log(`Source Range: ${s.source_timestamps} (${s.source_start?.toFixed(1)}s - ${s.source_end?.toFixed(1)}s)`);
    console.log(`Speaker Notes: ${s.speaker_notes}`);
    console.log('Cards:');
    (s.cards || []).forEach((c: any, cIdx: number) => {
      console.log(`  Card ${cIdx + 1}: ${c.card_title}`);
      (c.points || []).forEach((pt: string) => {
        console.log(`    • ${pt}`);
      });
    });
    console.log('');
  });
}

main();
