import fs from 'node:fs';
import path from 'node:path';
import { compilePptx } from '../core/slides/pptx-compiler.js';

async function run() {
  const hindiDeck = {
    theme: 'neon-matrix',
    detailLevel: 'balanced' as const,
    slides: [
      {
        title: 'आर्टिफिशियल इंटेलिजेंस (AI) का परिचय',
        subtitle: 'कृत्रिम बुद्धिमत्ता और भविष्य की तकनीक',
        category: 'अवलोकन 01',
        layout_type: 'split_cards' as const,
        cards: [
          {
            card_title: 'AI क्या है?',
            points: [
              'मशीनों में मानवीय बुद्धिमत्ता को शामिल करना',
              'स्मार्टफोन, रोबोटिक्स और आधुनिक एल्गोरिदम में उपयोग'
            ]
          },
          {
            card_title: 'मुख्य प्रकार',
            points: [
              'वीक AI (संकुचित): विशिष्ट कार्यों के लिए जैसे AlphaGo',
              'स्ट्रॉन्ग AI (सामान्य): भविष्य की स्व-जागरूक प्रणालियाँ'
            ]
          }
        ]
      }
    ]
  };

  const res = await compilePptx(hindiDeck, 'neon-matrix', 'AI in Hindi');
  console.log('Compiled Hindi PPTX bytes:', res.buffer.length);
  const outDir = path.resolve(process.cwd(), 'scratch');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'test_devanagari_render.pptx');
  fs.writeFileSync(outPath, res.buffer);
  console.log('Saved to:', outPath);
}

run().catch(console.error);
