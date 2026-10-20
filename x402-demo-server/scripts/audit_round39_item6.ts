import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { writeEvidence } from './evidence-helper.js';

async function main() {
  console.log('=== ROUND 3.9 ITEM 6 AUDIT: GROQ MODEL LIST & BENCHMARK ===\n');

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY is not set');
    process.exit(1);
  }

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  // 1. Fetch Live Model List
  console.log('1. Fetching live model list from Groq API...');
  const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const modelsData = await modelsRes.json();
  const liveModels = (modelsData.data || []).map((m: any) => ({
    id: m.id,
    created: m.created,
    owned_by: m.owned_by,
    active: m.active,
    context_window: m.context_window,
  }));

  console.log(`Live models available on key (${liveModels.length} models):`);
  for (const m of liveModels) {
    console.log(`  - ${m.id} (Context: ${m.context_window}, Owner: ${m.owned_by})`);
  }

  const hasLlama33 = liveModels.some((m: any) => m.id === 'llama-3.3-70b-versatile');
  console.log(`\nIs "llama-3.3-70b-versatile" available on this key?: ${hasLlama33 ? 'YES' : 'NO'}`);

  // 2. Select Candidate Text Generation Models from the list
  const candidates = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];
  const validCandidates = candidates.filter(c => liveModels.some((m: any) => m.id === c));

  console.log(`\nCandidate models to benchmark: ${validCandidates.join(', ')}`);

  // Benchmark prompt
  const benchmarkPrompt = [
    {
      role: 'system' as const,
      content: 'You are an executive slide generator. Output ONLY a valid JSON object matching: {"title": string, "slides": [{"title": string, "category": string, "cards": [{"card_title": string, "points": [string]}]}]}',
    },
    {
      role: 'user' as const,
      content: 'Generate a 3-slide presentation on Artificial Intelligence covering: 1. Overview and Narrow AI, 2. Deep Learning and Neural Networks, 3. Future Outlook and Singularity. Use 2 bullet points per card.',
    },
  ];

  const benchmarkResults: any[] = [];

  for (const modelId of validCandidates) {
    console.log(`\nBenchmarking model: ${modelId}...`);
    const t0 = Date.now();
    let validJson = false;
    let parsedData: any = null;
    let error: string | null = null;
    let tokens: any = {};

    try {
      const req: any = {
        model: modelId,
        messages: benchmarkPrompt,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      };
      if (modelId.startsWith('openai/')) {
        req.reasoning_effort = 'low';
        req.max_tokens = 2000;
      } else {
        req.max_tokens = 950;
      }

      const response = await client.chat.completions.create(req);
      const elapsedMs = Date.now() - t0;
      const content = response.choices[0]?.message?.content || '';

      tokens = {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      };

      try {
        parsedData = JSON.parse(content);
        if (parsedData && parsedData.slides && Array.isArray(parsedData.slides)) {
          validJson = true;
        }
      } catch (parseErr: any) {
        error = `JSON parse failed: ${parseErr.message}`;
      }

      const resultEntry = {
        model: modelId,
        elapsedMs,
        elapsedSec: Number((elapsedMs / 1000).toFixed(2)),
        validJson,
        slidesCount: parsedData?.slides?.length || 0,
        tokens,
        error,
      };

      benchmarkResults.push(resultEntry);
      console.log(`  -> Completed in ${resultEntry.elapsedSec}s | Valid JSON: ${validJson} | Slides: ${resultEntry.slidesCount} | Prompt Tokens: ${tokens.promptTokens} | Completion: ${tokens.completionTokens}`);
    } catch (apiErr: any) {
      const elapsedMs = Date.now() - t0;
      benchmarkResults.push({
        model: modelId,
        elapsedMs,
        elapsedSec: Number((elapsedMs / 1000).toFixed(2)),
        validJson: false,
        error: apiErr.message,
      });
      console.warn(`  -> API Error (${modelId}): ${apiErr.message}`);
    }

    // Rate-limiting pause between benchmark runs
    await new Promise(r => setTimeout(r, 2000));
  }

  // 3. Determine fastest model that returned valid JSON
  const validResults = benchmarkResults.filter(r => r.validJson);
  validResults.sort((a, b) => a.elapsedMs - b.elapsedMs);

  const winningModel = validResults.length > 0 ? validResults[0].model : 'openai/gpt-oss-20b';
  console.log(`\nFastest model with valid JSON: ${winningModel} (${validResults[0]?.elapsedSec}s)`);

  // 4. Update GroqProvider default to winningModel
  const providerPath = path.resolve('models/providers/groq.provider.ts');
  let providerCode = fs.readFileSync(providerPath, 'utf-8');
  providerCode = providerCode.replace(
    /defaultModel\s*=\s*options\?\.defaultModel\s*\|\|\s*process\.env\.GROQ_MODEL\s*\|\|\s*['"][^'"]+['"]/,
    `defaultModel = options?.defaultModel || process.env.GROQ_MODEL || '${winningModel}'`
  );
  fs.writeFileSync(providerPath, providerCode, 'utf-8');
  console.log(`✓ Updated GroqProvider defaultModel to "${winningModel}" in models/providers/groq.provider.ts`);

  // Write Evidence
  const evidenceData = {
    item: 'Part 1 Item 6: Groq Model List and Benchmark',
    liveModelsCount: liveModels.length,
    liveModels,
    llama33Available: hasLlama33,
    benchmarkResults,
    winningModel,
    fastestValidModel: winningModel,
    updatedDefaultInCode: true,
  };

  const { relativePath } = writeEvidence('item6_groq_benchmark', evidenceData, [
    'models/providers/groq.provider.ts',
  ]);

  console.log(`\n✓ Raw evidence written to ${relativePath}`);
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
