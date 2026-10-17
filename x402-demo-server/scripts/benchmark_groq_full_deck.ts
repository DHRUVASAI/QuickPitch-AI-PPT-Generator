import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';
import OpenAI from 'openai';
import { validateSlideDeck } from '../core/schemas/slide.schema.js';

async function main() {
  console.log('=' .repeat(80));
  console.log('ITEM 8: BENCHMARK GROQ gpt-oss-20b FULL 8-SLIDE DECK GENERATION');
  console.log('=' .repeat(80));

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY missing');

  const client = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
  const modelName = 'openai/gpt-oss-20b';

  const systemPrompt = `You are an expert executive presentation designer. Return strictly valid JSON containing an 8-slide executive presentation.
SCHEMA:
{
  "title": "Presentation Title",
  "theme": "cyber-blue",
  "slides": [
    {
      "slide_number": 1,
      "title": "Executive Summary",
      "subtitle": "Subtitle",
      "category": "EXECUTIVE BLUEPRINT",
      "cards": [
        {
          "card_title": "Pillar 1",
          "points": ["Bullet point 1", "Bullet point 2"]
        },
        {
          "card_title": "Pillar 2",
          "points": ["Bullet point 3", "Bullet point 4"]
        }
      ]
    }
  ]
}
RULES:
1. Return EXACTLY 8 slides in the "slides" array.
2. Every slide must have a title, subtitle, category, and 2 cards.
3. Every card must have a card_title and 2-3 concise bullet points.
4. Output ONLY valid JSON matching this schema.`;

  const userPrompt = `Create an 8-slide strategic presentation based on this source text:
"Artificial Intelligence overview: From everyday convenience in wardrobe sorting and personalized coffee brewing to autonomous robotic navigation and generalized learning. Two broad categories: Weak/Narrow AI like AlphaGo (champion in Go, incapable of chess) and Alexa (rule-based keyword execution), versus Strong AI like Ultron (self-aware with emotional synthesis). Machine learning uses algorithms to learn from data, while deep learning uses neural architectures inspired by the human brain. Milestones: Futurist Ray Kurzweil estimates parity with humans by 2045 (technological singularity), and Elon Musk anticipates brain-machine neural implants creating cyborg symbiosis. Quiz on AI projects including citizenship robots, muscular skeletal androids, and emotional comprehension."`;

  let retries = 0;
  const startTime = Date.now();

  const response = await client.chat.completions.create({
    model: modelName,
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  });

  const durationMs = Date.now() - startTime;
  const rawContent = response.choices[0]?.message?.content || '';

  let isValidJson = false;
  let parsedDeck: any = null;
  let validationErrors: string[] = [];
  let slideCount = 0;

  try {
    parsedDeck = JSON.parse(rawContent);
    isValidJson = true;
    slideCount = parsedDeck.slides?.length || 0;

    const validated = validateSlideDeck(parsedDeck);
    if (!validated) {
      validationErrors.push('Schema validation failed');
    }
  } catch (err: any) {
    isValidJson = false;
    validationErrors.push(err.message);
  }

  console.log(`\nModel: ${modelName}`);
  console.log(`Execution Time: ${durationMs} ms (${(durationMs / 1000).toFixed(2)}s)`);
  console.log(`Retries: ${retries}`);
  console.log(`Valid JSON: ${isValidJson ? 'YES' : 'NO'}`);
  console.log(`Slide Count: ${slideCount}`);
  console.log(`Validation Errors: ${validationErrors.length > 0 ? validationErrors.join(', ') : 'None (Strictly Valid)'}`);

  const report = {
    model: modelName,
    targetSlideCount: 8,
    actualSlideCount: slideCount,
    durationMs,
    durationSec: Number((durationMs / 1000).toFixed(2)),
    retries,
    isValidJson,
    validationErrors,
    usage: response.usage,
    deckTitle: parsedDeck?.title || 'Unknown',
  };

  fs.writeFileSync('scratch/item8_groq_timing.json', JSON.stringify(report, null, 2), 'utf-8');
  console.log('\nSaved report to scratch/item8_groq_timing.json');
}

main().catch(console.error);
