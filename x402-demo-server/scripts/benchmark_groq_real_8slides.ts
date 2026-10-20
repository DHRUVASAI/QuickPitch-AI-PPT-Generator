import fs from 'node:fs';
import path from 'node:path';
import { writeEvidence } from './evidence-helper.js';

async function runReal8SlideGroqBenchmark() {
  const root = path.resolve(__dirname, '../../');
  const serverDir = path.join(root, 'x402-demo-server');
  const unitsPath = path.join(serverDir, 'scratch/qzAHXO_step3_deduped_translated.json');
  const units = JSON.parse(fs.readFileSync(unitsPath, 'utf-8'));

  // Build 8 distinct chunks across the 327.9s video
  const targetSlideCount = 8;
  const contentSlidesCount = 7; // 1 cover + 7 content slides

  // Group units into 7 content chunks
  const chunkSize = Math.ceil(units.length / contentSlidesCount);
  const chunks: Array<{ index: number; timestamps: string; text: string }> = [];

  for (let i = 0; i < contentSlidesCount; i++) {
    const chunkUnits = units.slice(i * chunkSize, (i + 1) * chunkSize);
    if (chunkUnits.length === 0) continue;
    const start = chunkUnits[0].timestamps.split(' - ')[0];
    const end = chunkUnits[chunkUnits.length - 1].timestamps.split(' - ')[1];
    const text = chunkUnits.map((u: any) => u.translatedText || u.sourceText).join(' ');
    chunks.push({
      index: i + 1,
      timestamps: `${start} - ${end}`,
      text,
    });
  }

  const chunkPromptBlock = chunks
    .map(c => `[CHUNK ${c.index} | TIMESTAMPS: ${c.timestamps}]:\n"${c.text}"`)
    .join('\n\n');

  const systemPrompt = `You are a world-class presentation structuring engine. Output strictly valid JSON with a "slides" array.
ALL SLIDE TITLES, SUBTITLES, CATEGORY BADGES, CARD TITLES, BULLET POINTS, AND SPEAKER NOTES MUST BE IN ENGLISH.

CRITICAL GROUNDING INSTRUCTION:
Each slide MUST be generated strictly and exclusively from its matching ENGLISH CHUNK.
For each bullet point, return an object with:
- "text": The bullet statement in English
- "chunk_id": The chunk index this bullet comes from
- "quote": A short exact quote copied directly from that chunk
Do NOT invent numbers, names, or product terms.`;

  const userPrompt = `Generate EXACTLY ${contentSlidesCount} content slides based on these ${contentSlidesCount} distinct source chunks from the video:

OUTLINE:
Title: What is Artificial Intelligence? (AI Explained)
Subtitle: Everyday Automation, General Learning, and Future Frontiers
Key Topics: Everyday AI, Robot Reasoning, Weak AI vs Strong AI, Machine Learning & Deep Learning, Future Projections (2045)

AUDIENCE & TONE:
Target Audience: Executive Leadership
Presentation Tone: Professional, authoritative, and fact-based

SOURCE CHUNKS (Topic: "What is Artificial Intelligence?"):
${chunkPromptBlock}

Generate a JSON object with a "slides" array containing EXACTLY ${contentSlidesCount} objects matching:
{
  "slides": [
    {
      "title": "Clear English Slide Title from Chunk",
      "subtitle": "Informative subtitle in English",
      "category": "CATEGORY BADGE",
      "source_timestamps": "00:00 - 01:15",
      "cards": [
        {
          "card_title": "Card Title",
          "points": [
            { "text": "Bullet statement", "chunk_id": 1, "quote": "exact quote from chunk" }
          ]
        }
      ]
    }
  ]
}`;

  // Read Groq API Key
  const envPath = path.join(serverDir, '.env');
  let apiKey = process.env.GROQ_API_KEY;
  if (!apiKey && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const m = envContent.match(/GROQ_API_KEY=([^\r\n]+)/);
    if (m) apiKey = m[1].trim();
  }

  if (!apiKey) {
    throw new Error('GROQ_API_KEY not found in environment or .env');
  }

  const modelToTest = 'openai/gpt-oss-20b';
  console.log(`Sending real 8-slide prompt to Groq model "${modelToTest}"...`);

  const startTime = Date.now();
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelToTest,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  const durationSec = (Date.now() - startTime) / 1000;
  const status = response.status;
  const resJson = await response.json();

  if (!response.ok) {
    throw new Error(`Groq API returned HTTP ${status}: ${JSON.stringify(resJson)}`);
  }

  const usage = resJson.usage || {};
  const content = resJson.choices?.[0]?.message?.content || '';
  let isValidJson = false;
  let parsedSlidesCount = 0;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed.slides)) {
      isValidJson = true;
      parsedSlidesCount = parsed.slides.length;
    }
  } catch {}

  const result = writeEvidence(
    'groq_real_8slides_benchmark.json',
    {
      description: 'Groq benchmark using the real 8-slide prompt and real video chunks from qzAHXO-cN5Q.',
      model: modelToTest,
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      httpStatus: status,
      durationSeconds: Number(durationSec.toFixed(3)),
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      isValidJson,
      parsedSlidesCount,
      chunksUsed: chunks.length,
      sampleResponseSnippet: content.slice(0, 500),
    },
    [
      'scratch/qzAHXO_step3_deduped_translated.json',
      'core/synthesis/slide-planner.ts',
    ]
  );

  console.log(`Real 8-slide Groq benchmark written to ${result.relativePath}`);
  console.log(`Prompt Tokens: ${usage.prompt_tokens}`);
  console.log(`Completion Tokens: ${usage.completion_tokens}`);
  console.log(`Duration: ${durationSec.toFixed(3)}s`);
  console.log(`Valid JSON: ${isValidJson}, Slides: ${parsedSlidesCount}`);
}

runReal8SlideGroqBenchmark().catch(err => {
  console.error('Groq benchmark error:', err);
  process.exit(1);
});
