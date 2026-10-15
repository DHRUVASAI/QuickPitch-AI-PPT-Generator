import type { UnifiedModelClient } from '../../models/unified-client.js';
import type { ChatMessage } from '../../models/types.js';
import type { TranscriptData } from '../schemas/transcript.schema.js';
import { type PresentationOutline, validatePresentationOutline } from '../schemas/outline.schema.js';

export function calculateSlideCount(textLen: number, detailLevel: string = 'balanced'): number {
  if (detailLevel === 'concise') {
    return 7;
  }
  if (detailLevel === 'detailed') {
    if (textLen > 10000) return 15;
    if (textLen > 5000) return 13;
    return 11;
  }
  if (textLen > 12000) return 12;
  if (textLen > 6000) return 10;
  if (textLen > 3000) return 8;
  return 7;
}

/**
 * Executes a synthesis prompt against a specific provider with:
 * 1. Schema validation
 * 2. On validation failure, retries ONCE with the error message
 * 3. Throws if retry also fails so the next provider in the fallback chain is tried
 */
async function callProviderWithValidationRetry(
  client: UnifiedModelClient,
  providerName: string,
  systemPrompt: string,
  userPrompt: string
): Promise<any> {
  const initialMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const firstAttempt = await client.completeWith(providerName, initialMessages, {
    temperature: 0.2,
    maxTokens: 1800,
    jsonMode: true,
  });

  let rawContent = firstAttempt.content;
  let validationError: Error | null = null;

  try {
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    const parsed = JSON.parse(match[0]);
    return validatePresentationOutline(parsed);
  } catch (err: any) {
    validationError = err;
    console.warn(`[Synthesis: ${providerName}] Schema validation failed on 1st attempt: ${err.message}. Retrying once with error feedback...`);
  }

  // Retry ONCE with the error message
  const correctionMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
    { role: 'assistant', content: rawContent },
    {
      role: 'user',
      content: `Your previous response failed schema validation with error: "${validationError?.message}".\nPlease fix the errors and output strictly valid JSON matching the schema.`,
    },
  ];

  const secondAttempt = await client.completeWith(providerName, correctionMessages, {
    temperature: 0.1,
    maxTokens: 1800,
    jsonMode: true,
  });

  const match2 = secondAttempt.content.match(/\{[\s\S]*\}/);
  if (!match2) throw new Error(`Schema validation failed on retry: ${validationError?.message}`);
  return validatePresentationOutline(JSON.parse(match2[0]));
}

/**
 * Synthesizes an executive presentation outline using the fallback chain:
 * 1. Local Ollama (Qwen 2.5 7B)
 * 2. Hosted Model (Groq LLaMA 3.3 / Gemini)
 * 3. Partial Deterministic Outline (Never fails the whole request)
 */
export interface SynthesizeOutlineOptions {
  allowCloudFallback?: boolean;
}

export async function synthesizeOutline(
  transcript: TranscriptData,
  client: UnifiedModelClient,
  detailLevel: string = 'balanced',
  options?: SynthesizeOutlineOptions
): Promise<PresentationOutline & { providerUsed?: string }> {
  const targetCount = calculateSlideCount(transcript.charCount, detailLevel);
  const cleanContext = transcript.sanitizedText.slice(0, 14000);

  const systemPrompt = 'You are an executive research analyst and domain strategist. Output strictly valid JSON matching the schema.';
  const userPrompt = `Extract a comprehensive, factual research outline from the following content:

SOURCE CONTENT (Topic / Title: "${transcript.title}"):
"${cleanContext}"

Return strictly valid JSON matching:
{
  "title": "Clear Executive Title",
  "subtitle": "Informative subtitle capturing the essence",
  "pillars": [
    { "name": "Pillar 1", "description": "Summary of pillar 1" },
    { "name": "Pillar 2", "description": "Summary of pillar 2" },
    { "name": "Pillar 3", "description": "Summary of pillar 3" },
    { "name": "Pillar 4", "description": "Summary of pillar 4" }
  ],
  "keyTopics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"]
}`;

  const allowCloud = options?.allowCloudFallback ?? (process.env.ALLOW_CLOUD_FALLBACK === 'true');
  const primaryName = client.getPrimaryProviderName();
  const providerOrder = [primaryName, ...client.getRegisteredProviders().filter((p) => p !== primaryName)];

  for (const providerName of providerOrder) {
    const provider = client.getProvider(providerName);
    if (!provider) continue;

    // Cloud fallback is opt-in: skip cloud providers when false
    if (!allowCloud && provider.isLocal === false) {
      continue;
    }

    try {
      if (await provider.isAvailable()) {
        console.log(`[SynthesisChain: Outline] Trying provider: ${providerName}...`);
        const outline = await callProviderWithValidationRetry(client, providerName, systemPrompt, userPrompt);
        console.log(`✓ [SynthesisChain: Outline] Provider "${providerName}" succeeded with validated schema`);
        return { ...outline, targetSlideCount: targetCount, providerUsed: providerName };
      }
    } catch (err: any) {
      console.warn(`[SynthesisChain: Outline] Provider "${providerName}" failed:`, err.message);
    }
  }

  // Chain 3: Partial Result with clear message (Never fail whole request)
  console.warn('⚠️ [SynthesisChain: Outline] Local provider unavailable/failed (and cloud fallback disabled). Returning deterministic outline.');
  return {
    ...validatePresentationOutline({
      title: transcript.title,
      subtitle: '[Partial Synthesis] Key strategic takeaways derived directly from transcript',
      pillars: [
        { name: 'Core Perspective', description: 'Primary thesis and background extracted from transcript' },
        { name: 'Key Challenges', description: 'Identified friction points and strategic challenges' },
        { name: 'Tactical Interventions', description: 'Actionable solutions, frameworks, and insights' },
        { name: 'Long-term Impact', description: 'Expected trajectory, outcomes, and value' },
      ],
      keyTopics: ['Executive Overview', 'Direct Findings', 'Strategic Blueprint', 'Execution Plan'],
      targetSlideCount: targetCount,
      rawSynthesis: '[Partial Result: Model synthesis timed out or was offline. Built via deterministic fallback engine]',
    }),
    providerUsed: 'deterministic-fallback',
  };
}
