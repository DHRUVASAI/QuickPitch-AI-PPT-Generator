import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { GroqProvider } from '../models/providers/groq.provider.js';

dotenv.config();

const serverDir = path.resolve(__dirname, '..');
const rootEvidenceDir = path.resolve(serverDir, '..', 'evidence', 'round39');

async function main() {
  console.log('=== AUDITING ITEM 5: GROQ RUNTIME MODEL LIST QUERY & CLOUD TELEMETRY ===');

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set');
  }

  // 1. Direct runtime query to Groq models endpoint
  console.log('Querying Groq models list at https://api.groq.com/openai/v1/models...');
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const httpStatus = res.status;
  const data: any = await res.json();
  const listedModels: string[] = (data.data || []).map((m: any) => m.id);

  console.log(`HTTP Status: ${httpStatus} | Total Listed Models: ${listedModels.length}`);
  console.log('Listed Models:', listedModels);

  // 2. Instantiate GroqProvider and execute 3 real cloud completion calls
  const groq = new GroqProvider({ apiKey });
  const activeListed = await groq.getListedModels();

  const testPrompts = [
    'State in 1 sentence what artificial intelligence is.',
    'List 3 common everyday applications of AI.',
    'Is weak AI restricted to a single domain? Answer in 1 word.',
  ];

  const callRecords: any[] = [];
  for (let i = 0; i < testPrompts.length; i++) {
    const prompt = testPrompts[i];
    const callStart = Date.now();
    try {
      const completion = await groq.complete(
        [
          { role: 'system', content: 'You are a concise AI assistant.' },
          { role: 'user', content: prompt },
        ],
        {
          model: 'openai/gpt-oss-20b',
          maxTokens: 50,
          temperature: 0.1,
        }
      );
      const callDurationMs = Date.now() - callStart;
      callRecords.push({
        callIndex: i + 1,
        prompt,
        modelUsed: completion.model,
        durationMs: callDurationMs,
        usage: completion.usage,
        responseSnippet: completion.content.trim().slice(0, 80),
      });
      console.log(`✓ Call ${i + 1} succeeded in ${callDurationMs}ms (Model: ${completion.model}, Tokens: ${completion.usage?.totalTokens})`);
    } catch (err: any) {
      callRecords.push({
        callIndex: i + 1,
        prompt,
        error: err.message,
      });
      console.warn(`✗ Call ${i + 1} failed: ${err.message}`);
    }
  }

  const telemetry = groq.getTelemetry();

  const uiPrivacyText = 'Privacy Notice (Cloud Enabled): Translation, outline, slide planning, and verification will prioritize Groq cloud API (openai/gpt-oss-20b). Transcript text and synthesis prompts are transmitted over TLS to Groq\'s API servers.';

  const report = {
    timestamp: new Date().toISOString(),
    audit: 'Round 3.9 Part 1.10 Item 5 - Groq Runtime Models List & Cloud Telemetry',
    runtimeModelListQuery: {
      endpoint: 'https://api.groq.com/openai/v1/models',
      httpStatus,
      totalListedModels: listedModels.length,
      listedModels,
      selectedModelForGeneration: 'openai/gpt-oss-20b',
    },
    uiPrivacyTextMapping: {
      location: 'QuickPitchHome.tsx (lines 1148-1154)',
      displayedModelName: 'openai/gpt-oss-20b',
      text: uiPrivacyText,
    },
    cloudTelemetry: {
      totalCalls: telemetry.totalCalls,
      latestHttpStatus: telemetry.httpStatus,
      count429: telemetry.count429,
      retries: telemetry.retries,
      tokensPerCall: telemetry.tokensPerCall,
      averagePromptTokens: Math.round(telemetry.tokensPerCall.reduce((a, t) => a + (t.promptTokens || 0), 0) / (telemetry.tokensPerCall.length || 1)),
      averageCompletionTokens: Math.round(telemetry.tokensPerCall.reduce((a, t) => a + (t.completionTokens || 0), 0) / (telemetry.tokensPerCall.length || 1)),
      averageTotalTokens: Math.round(telemetry.tokensPerCall.reduce((a, t) => a + (t.totalTokens || 0), 0) / (telemetry.tokensPerCall.length || 1)),
    },
    callRecords,
  };

  const outPath = path.join(rootEvidenceDir, 'round391_part110_item5_groq_runtime_models.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n✅ Saved Item 5 evidence to: ${outPath}`);
}

main().catch(console.error);
