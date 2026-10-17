import dotenv from 'dotenv';
dotenv.config();
import OpenAI from 'openai';

interface BenchmarkResult {
  model: string;
  success: boolean;
  durationMs: number;
  retries: number;
  validJson: boolean;
  slideCount: number;
  error?: string;
  reasoningEffortUsed?: string;
  firstSlideTitle?: string;
}

async function runGroqBenchmark() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing');
  }

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const models = [
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
  ];

  const systemPrompt = `You are a world-class presentation structuring engine. Output strictly valid JSON with a "slides" array.
ALL SLIDE TITLES, SUBTITLES, CATEGORY BADGES, CARD TITLES, BULLET POINTS, AND SPEAKER NOTES MUST BE IN ENGLISH.
CRITICAL GROUNDING INSTRUCTION:
Each slide MUST be generated strictly and exclusively from its matching CHUNK.
Do NOT invent numbers, names, or product terms.`;

  const userPrompt = `Generate EXACTLY 4 content slides based on these 4 distinct source chunks from the video:

SOURCE CHUNKS (Topic: "Artificial Intelligence Definition & Evolution"):
[CHUNK 1 | TIMESTAMPS: 00:00 - 01:21 (0.4s to 81.9s)]:
"Imagine a machine that sets your wardrobe according to your preferences or serves coffee to every family member according to their taste, basically making every day easier. This is artificial intelligence. Why is the term artificial intelligence used? Because in these machines, human-like intelligence is artificially incorporated so they can perform tasks like us. Every intelligence is built using complex algorithms and mathematical functions. Today, AI is used in smartphones, cars, social media feeds, video games, banking, and surveillance."

[CHUNK 2 | TIMESTAMPS: 01:21 - 02:43 (81.9s to 163.9s)]:
"Let's understand this with an example. Suppose a robot is on a road where one path is paved and the other is rocky. Based on the situation, the robot must decide which path to take. To do this, the robot needs sensory input through cameras, radar, and sensors to know what is happening around it. The second step is learning: understanding what was observed. The third step is problem solving: deciding the right action to reach the destination safely. These three capabilities make the robot artificially intelligent."

[CHUNK 3 | TIMESTAMPS: 02:43 - 04:05 (163.9s to 245.9s)]:
"Today's AI is classified into Weak AI (Narrow AI) and Strong AI. Weak AI is designed to solve specific tasks. It is limited to the scope of that task. Examples include AI in smartphones, cars, and recommendation systems. Strong AI refers to machines that have generalized human-level intelligence and emotions, which currently exist only in imagination. Renowned futurist Ray Kurzweil estimates that by year 2045 we will have robots as smart as humans, a milestone called the Singularity."

[CHUNK 4 | TIMESTAMPS: 04:05 - 05:27 (245.9s to 327.9s)]:
"Singularity is that hypothetical point in time when technological growth becomes uncontrollable and irreversible, resulting in unfathomable changes to human civilization. When AI surpasses human intelligence, machines could improve their own software and hardware exponentially. While this brings enormous potential for medicine and scientific discovery, it also poses existential risks if goals are not aligned with human safety."

Generate a JSON object with a "slides" array containing EXACTLY 4 objects matching:
{
  "slides": [
    {
      "title": "Clear English Slide Title from Chunk",
      "subtitle": "Informative subtitle in English",
      "category": "CATEGORY BADGE",
      "source_timestamps": "00:00 - 01:21",
      "source_start": 0.4,
      "source_end": 81.9,
      "layout_type": "split_cards",
      "speaker_notes": "Key speaker notes for the presenter in English",
      "cards": [
        { "card_title": "Core Concept", "points": ["Point 1", "Point 2"] },
        { "card_title": "Real Applications", "points": ["Point 1", "Point 2"] }
      ]
    }
  ]
}`;

  console.log('='.repeat(80));
  console.log('GROQ BENCHMARK: Slide Generation on 3 Candidate Models');
  console.log('='.repeat(80));

  const results: BenchmarkResult[] = [];

  for (const model of models) {
    console.log(`\nTesting model: ${model}...`);
    let retries = 0;
    const maxRetries = 2;
    let success = false;
    let durationMs = 0;
    let validJson = false;
    let slideCount = 0;
    let firstTitle = '';
    let errorMsg = '';
    let reasoningEffortUsed = 'none';

    // First try with reasoning_effort if supported
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const t0 = performance.now();
      try {
        const params: any = {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        };

        // Try low reasoning effort
        try {
          params.reasoning_effort = 'low';
          reasoningEffortUsed = 'low';
        } catch {}

        let completion;
        try {
          completion = await client.chat.completions.create(params);
        } catch (reasonErr: any) {
          if (reasonErr.message?.includes('reasoning_effort') || reasonErr.status === 400) {
            delete params.reasoning_effort;
            reasoningEffortUsed = 'unsupported';
            completion = await client.chat.completions.create(params);
          } else {
            throw reasonErr;
          }
        }

        const t1 = performance.now();
        durationMs = Math.round(t1 - t0);

        const content = completion.choices[0]?.message?.content || '';
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.slides) && parsed.slides.length > 0) {
          validJson = true;
          slideCount = parsed.slides.length;
          firstTitle = parsed.slides[0]?.title || '';
          success = true;
          console.log(`  ✓ Success in ${durationMs}ms (${(durationMs / 1000).toFixed(2)}s) | Retries: ${retries} | Slides: ${slideCount} | Reasoning: ${reasoningEffortUsed}`);
          console.log(`    First slide: "${firstTitle}"`);
          break;
        } else {
          throw new Error(`JSON parsed but missing valid slides array: ${content.slice(0, 100)}`);
        }
      } catch (err: any) {
        retries++;
        errorMsg = err.message;
        console.warn(`  ⚠️ Attempt ${attempt + 1} failed for ${model}: ${err.message}`);
        if (attempt === maxRetries) {
          const t1 = performance.now();
          durationMs = Math.round(t1 - t0);
        }
      }
    }

    results.push({
      model,
      success,
      durationMs,
      retries: Math.max(0, retries - (success ? 1 : 0)),
      validJson,
      slideCount,
      error: success ? undefined : errorMsg,
      reasoningEffortUsed,
      firstSlideTitle: firstTitle,
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('BENCHMARK SUMMARY TABLE:');
  console.log('='.repeat(80));
  console.table(results.map(r => ({
    Model: r.model,
    Success: r.success ? 'YES' : 'NO',
    'Latency (ms)': r.durationMs,
    'Latency (s)': (r.durationMs / 1000).toFixed(2),
    Retries: r.retries,
    'Valid JSON': r.validJson ? 'YES' : 'NO',
    'Slide Count': r.slideCount,
    'Reasoning Effort': r.reasoningEffortUsed,
  })));

  const validFastest = [...results]
    .filter(r => r.success && r.validJson && r.slideCount >= 3)
    .sort((a, b) => a.durationMs - b.durationMs)[0];

  if (validFastest) {
    console.log(`\n>>> FASTEST MODEL RETURNING VALID JSON: ${validFastest.model} (${validFastest.durationMs}ms) <<<`);
  }

  return { results, fastest: validFastest?.model };
}

runGroqBenchmark().catch(err => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
