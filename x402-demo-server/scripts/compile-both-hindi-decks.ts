import fs from 'node:fs';
import path from 'node:path';
import { compilePptx } from '../core/slides/pptx-compiler.js';

async function compileBoth() {
  const capsData = JSON.parse(fs.readFileSync('scratch/deck_from_captions.json', 'utf-8'));
  const whisperData = JSON.parse(fs.readFileSync('scratch/deck_from_whisper.json', 'utf-8'));

  const capsDeck = {
    theme: 'neon-matrix',
    detailLevel: 'balanced' as const,
    slides: capsData.slides.map((s: any) => ({
      title: s.title,
      category: 'Overview',
      layout_type: 'cards' as const,
      cards: [{ card_title: s.title, points: s.bullets }]
    }))
  };

  const whisperDeck = {
    theme: 'neon-matrix',
    detailLevel: 'balanced' as const,
    slides: whisperData.slides.map((s: any) => ({
      title: s.title,
      category: 'Overview',
      layout_type: 'cards' as const,
      cards: [{ card_title: s.title, points: s.bullets }]
    }))
  };

  const resCaps = await compilePptx(capsDeck, 'neon-matrix', 'Captions');
  const resWhisper = await compilePptx(whisperDeck, 'neon-matrix', 'Whisper');

  fs.writeFileSync('scratch/hindi_deck_captions.pptx', resCaps.buffer);
  fs.writeFileSync('scratch/hindi_deck_whisper.pptx', resWhisper.buffer);

  console.log('Successfully compiled PPTX files:');
  console.log('scratch/hindi_deck_captions.pptx bytes:', resCaps.buffer.length);
  console.log('scratch/hindi_deck_whisper.pptx bytes:', resWhisper.buffer.length);
}

compileBoth().catch(console.error);
