import type { UnifiedModelClient } from '../../models/unified-client.js';
import type { ChatMessage } from '../../models/types.js';
import type { TranscriptData } from '../schemas/transcript.schema.js';
import { type PresentationOutline, validatePresentationOutline } from '../schemas/outline.schema.js';
import { gpuLock } from '../utils/gpu-lock.js';

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

export function chunkTranscriptText(text: string, chunkSize: number = 5500, overlap: number = 300): string[] {
  if (!text || text.length <= chunkSize) return [text || ''];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const bestBreak = Math.max(lastPeriod, lastNewline);
      if (bestBreak > start + chunkSize * 0.7) {
        end = bestBreak + 1;
      }
    }
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

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
    maxTokens: 2000,
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
      content: `Your previous response failed schema validation with error: "${validationError?.message}".\nPlease fix the errors and output strictly valid JSON matching the schema. Output STRICTLY IN ENGLISH.`,
    },
  ];

  const secondAttempt = await client.completeWith(providerName, correctionMessages, {
    temperature: 0.1,
    maxTokens: 2000,
    jsonMode: true,
  });

  const match2 = secondAttempt.content.match(/\{[\s\S]*\}/);
  if (!match2) throw new Error(`Schema validation failed on retry: ${validationError?.message}`);
  return validatePresentationOutline(JSON.parse(match2[0]));
}

export interface SynthesizeOutlineOptions {
  allowCloudFallback?: boolean;
  outputLanguage?: string;
  targetSlideCount?: number;
  slideCount?: number;
  audience?: string;
  tone?: string;
  focusText?: string;
  includeAgenda?: boolean;
  includeSummary?: boolean;
}

export async function synthesizeOutline(
  transcript: TranscriptData,
  client: UnifiedModelClient,
  detailLevel: string = 'balanced',
  options?: SynthesizeOutlineOptions
): Promise<PresentationOutline & { providerUsed?: string }> {
  const rawTarget = options?.targetSlideCount || options?.slideCount;
  const targetCount = rawTarget && rawTarget >= 3 && rawTarget <= 30
    ? rawTarget
    : calculateSlideCount(transcript.charCount, detailLevel);

  // Full transcript chunking support across entire video
  const chunks = chunkTranscriptText(transcript.sanitizedText, 6000, 300);
  let contentContext = '';
  if (chunks.length === 1) {
    contentContext = chunks[0];
  } else {
    // Multi-chunk overview synthesizing beginning, middle, and end of video
    contentContext = chunks.map((c, i) => `[SECTION ${i + 1}/${chunks.length}]:\n${c}`).join('\n\n');
    if (contentContext.length > 25000) {
      // Keep rich context while respecting model prompt budgets
      contentContext = chunks.map((c, i) => `[SECTION ${i + 1}/${chunks.length}]:\n${c.slice(0, 4000)}`).join('\n\n');
    }
  }

  const audienceStr = options?.audience ? `Target Audience: ${options.audience}\n` : '';
  const toneStr = options?.tone ? `Presentation Tone: ${options.tone}\n` : '';
  const focusStr = options?.focusText ? `Special Focus / Key Instructions: ${options.focusText}\n` : '';

  const systemPrompt = 'You are an executive research analyst and presentation strategist. Output strictly valid JSON matching the schema. All content MUST BE IN ENGLISH.';
  const userPrompt = `Extract a comprehensive, factual research outline from the following content:
${audienceStr}${toneStr}${focusStr}
OUTPUT LANGUAGE REQUIREMENT: Output all presentation titles, subtitles, pillars, and keyTopics STRICTLY IN ENGLISH. If the source material is in Hindi, Telugu, or another language, translate concepts accurately into clear English.

SOURCE CONTENT (Topic / Title: "${transcript.title}"):
"${contentContext}"

Target Slide Count: ${targetCount}

Return strictly valid JSON matching:
{
  "title": "Clear Executive English Title",
  "subtitle": "Informative subtitle capturing the essence in English",
  "pillars": [
    { "name": "Pillar 1", "description": "Summary of pillar 1 in English" },
    { "name": "Pillar 2", "description": "Summary of pillar 2 in English" },
    { "name": "Pillar 3", "description": "Summary of pillar 3 in English" },
    { "name": "Pillar 4", "description": "Summary of pillar 4 in English" }
  ],
  "keyTopics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"]
}`;

  const allowCloud = options?.allowCloudFallback ?? (process.env.ALLOW_CLOUD_FALLBACK === 'true');
  const primaryName = client.getPrimaryProviderName();
  const providerOrder = [primaryName, ...client.getRegisteredProviders().filter((p) => p !== primaryName)];

  for (const providerName of providerOrder) {
    const provider = client.getProvider(providerName);
    if (!provider) continue;

    if (!allowCloud && provider.isLocal === false) {
      continue;
    }

    try {
      if (await provider.isAvailable()) {
        console.log(`[SynthesisChain: Outline] Trying provider: ${providerName}...`);

        let outlineResult: any;
        if (providerName === 'ollama') {
          const releaseGpu = await gpuLock.acquire('Ollama-Outline');
          try {
            outlineResult = await callProviderWithValidationRetry(
              client,
              providerName,
              systemPrompt,
              userPrompt
            );
          } finally {
            releaseGpu();
          }
        } else {
          outlineResult = await callProviderWithValidationRetry(
            client,
            providerName,
            systemPrompt,
            userPrompt
          );
        }

        console.log(`✓ [SynthesisChain: Outline] Provider "${providerName}" succeeded with outline: "${outlineResult.title}"`);
        return {
          ...outlineResult,
          targetSlideCount: targetCount,
          providerUsed: providerName,
        };
      }
    } catch (err: any) {
      console.warn(`[SynthesisChain: Outline] Provider "${providerName}" failed:`, err.message);
    }
  }

  // Fallback outline
  console.warn('⚠️ [SynthesisChain: Outline] Local provider unavailable/failed. Returning deterministic fallback outline.');
  const fallbackPillars = [
    { name: 'Core Foundations & Setting', description: 'Foundational context and primary observations.' },
    { name: 'Strategic Insights', description: 'Key operational dynamics and drivers.' },
    { name: 'Transformation & Impact', description: 'Key measurable domain outcomes.' },
    { name: 'Action Roadmap', description: 'Actionable execution steps and milestones.' },
  ];

  return {
    title: transcript.title || 'Executive Presentation',
    subtitle: '[Partial Result] Strategic Overview and Key Takeaways',
    pillars: fallbackPillars,
    keyTopics: ['Executive Overview', 'Key Drivers', 'Deep Dive', 'Action Plan'],
    targetSlideCount: targetCount,
    rawSynthesis: '[Partial Result] Deterministic NLP Outline',
    providerUsed: 'deterministic-fallback',
  };
}
