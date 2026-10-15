import type { UnifiedModelClient } from '../../models/unified-client.js';
import type { ChatMessage } from '../../models/types.js';
import type { TranscriptData } from '../schemas/transcript.schema.js';
import type { PresentationOutline } from '../schemas/outline.schema.js';
import { type SlideDeck, type SlideItem, type SlideLayoutType, validateSlideDeck } from '../schemas/slide.schema.js';
import { cleanTextForPptx } from '../transcript/sanitizer.js';

const LAYOUT_CYCLE: SlideLayoutType[] = [
  'split_cards',
  'three_columns',
  'hero_quote',
  'stats_spotlight',
  'comparison_split',
  'roadmap_timeline',
  'diagram_flow',
  'data_table',
  'four_columns',
  'quadrant_grid',
  'outro_slide',
];

function buildFallbackNLPDeck(transcript: TranscriptData, targetCount: number, isPartial: boolean = true): SlideItem[] {
  const text = transcript.sanitizedText;
  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 180 && !/^(and|but|or|so|because)/i.test(s));

  const slides: SlideItem[] = [];
  const contentCount = Math.max(4, targetCount - 1);

  for (let i = 0; i < contentCount; i++) {
    const layout = LAYOUT_CYCLE[i % LAYOUT_CYCLE.length];
    const s1 = sentences[(i * 3) % (sentences.length || 1)] || 'Strategic observation and findings.';
    const s2 = sentences[(i * 3 + 1) % (sentences.length || 1)] || 'Tactical execution and domain implications.';
    const s3 = sentences[(i * 3 + 2) % (sentences.length || 1)] || 'Key measurable impact and transformation.';

    slides.push({
      title: `${transcript.title} - Pillar ${i + 1}`,
      subtitle: isPartial ? `[Partial Result] Key insights for section ${i + 1}` : `Key insights for section ${i + 1}`,
      category: `PILLAR 0${i + 1}`,
      layout_type: layout,
      quote: layout === 'hero_quote' ? s1 : undefined,
      quote_author: layout === 'hero_quote' ? transcript.title : undefined,
      cards: [
        { card_title: 'Core Finding', points: [s1, s2] },
        { card_title: 'Action Item', points: [s3] },
      ],
    });
  }

  return slides;
}

async function callProviderForSlidesWithValidationRetry(
  client: UnifiedModelClient,
  providerName: string,
  systemPrompt: string,
  userPrompt: string,
  theme: string,
  detailLevel: 'concise' | 'balanced' | 'detailed'
): Promise<SlideDeck> {
  const initialMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const firstAttempt = await client.completeWith(providerName, initialMessages, {
    temperature: 0.3,
    maxTokens: 3500,
    jsonMode: true,
  });

  let rawContent = firstAttempt.content;
  let validationError: Error | null = null;

  try {
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    const parsed = JSON.parse(match[0]);
    return validateSlideDeck({
      theme,
      detailLevel,
      slides: parsed.slides,
    });
  } catch (err: any) {
    validationError = err;
    console.warn(`[SlidePlanner: ${providerName}] Schema validation failed on 1st attempt: ${err.message}. Retrying once with error feedback...`);
  }

  // Retry ONCE with error message
  const correctionMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
    { role: 'assistant', content: rawContent },
    {
      role: 'user',
      content: `Your previous response failed slide schema validation with error: "${validationError?.message}".\nPlease fix the errors and output strictly valid JSON with a "slides" array matching the requested schema.`,
    },
  ];

  const secondAttempt = await client.completeWith(providerName, correctionMessages, {
    temperature: 0.2,
    maxTokens: 3500,
    jsonMode: true,
  });

  const match2 = secondAttempt.content.match(/\{[\s\S]*\}/);
  if (!match2) throw new Error(`Slide schema validation failed on retry: ${validationError?.message}`);
  const parsed2 = JSON.parse(match2[0]);

  return validateSlideDeck({
    theme,
    detailLevel,
    slides: parsed2.slides,
  });
}

/**
 * Plans and generates structured slides using the fallback chain:
 * 1. Local Ollama (Qwen 2.5 7B)
 * 2. Hosted Model (Groq LLaMA 3.3 / Gemini)
 * 3. Partial Deterministic NLP Deck (Never fails the whole request)
 */
import { gpuLock } from '../utils/gpu-lock.js';

export interface PlanSlideStructureOptions {
  allowCloudFallback?: boolean;
  outputLanguage?: string;
}

export async function planSlideStructure(
  outline: PresentationOutline,
  transcript: TranscriptData,
  client: UnifiedModelClient,
  theme: string = 'cyber-blue',
  detailLevel: 'concise' | 'balanced' | 'detailed' = 'balanced',
  options?: PlanSlideStructureOptions
): Promise<SlideDeck & { providerUsed?: string }> {
  const targetCount = outline.targetSlideCount || 7;
  const contentSlidesCount = targetCount - 1;

  const langInstruction =
    options?.outputLanguage && options.outputLanguage.toLowerCase() !== 'same as video'
      ? `\nOUTPUT LANGUAGE: Output all slide titles, subtitles, category badges, card titles, and bullet points strictly in "${options.outputLanguage}".`
      : '';

  const systemPrompt = `You are a presentation structuring engine. Output strictly valid JSON with a "slides" array.${langInstruction}`;
  const userPrompt = `Generate exactly ${contentSlidesCount} content slides based on this research outline and source context:

OUTLINE:
Title: ${outline.title}
Subtitle: ${outline.subtitle}
Pillars: ${JSON.stringify(outline.pillars)}
Key Topics: ${outline.keyTopics.join(', ')}

TRANSCRIPT SUMMARY:
"${transcript.sanitizedText.slice(0, 8000)}"

Generate a JSON object with a "slides" array containing ${contentSlidesCount} objects matching:
{
  "slides": [
    {
      "title": "Clear Slide Title",
      "subtitle": "Informative subtitle",
      "category": "CATEGORY BADGE",
      "layout_type": "split_cards | three_columns | four_columns | hero_quote | stats_spotlight | comparison_split | roadmap_timeline | diagram_flow | data_table | quadrant_grid | outro_slide",
      "cards": [
        { "card_title": "Card Title 1", "points": ["Point 1", "Point 2", "Point 3"] },
        { "card_title": "Card Title 2", "points": ["Point 1", "Point 2", "Point 3"] }
      ]
    }
  ]
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
        console.log(`[SynthesisChain: Slides] Trying provider: ${providerName}...`);

        let deck: any;
        if (providerName === 'ollama') {
          const releaseGpu = await gpuLock.acquire('Ollama-Slides');
          try {
            deck = await callProviderForSlidesWithValidationRetry(
              client,
              providerName,
              systemPrompt,
              userPrompt,
              theme,
              detailLevel
            );
          } finally {
            releaseGpu();
          }
        } else {
          deck = await callProviderForSlidesWithValidationRetry(
            client,
            providerName,
            systemPrompt,
            userPrompt,
            theme,
            detailLevel
          );
        }
        console.log(`✓ [SynthesisChain: Slides] Provider "${providerName}" succeeded with validated slides`);
        return { ...deck, providerUsed: providerName };
      }
    } catch (err: any) {
      console.warn(`[SynthesisChain: Slides] Provider "${providerName}" failed:`, err.message);
    }
  }

  // Chain 3: Partial Result with clear message (Never fail whole request)
  console.warn('⚠️ [SynthesisChain: Slides] Local provider unavailable/failed (and cloud fallback disabled). Returning partial deterministic slide deck.');
  const fallbackSlides = buildFallbackNLPDeck(transcript, targetCount, true).map((s, idx) => ({
    ...s,
    title: cleanTextForPptx(s.title, 60),
    subtitle: cleanTextForPptx(s.subtitle || '', 100),
    category: cleanTextForPptx(s.category || 'STRATEGIC INSIGHT', 30),
    layout_type: s.layout_type || LAYOUT_CYCLE[idx % LAYOUT_CYCLE.length],
  }));

  return {
    ...validateSlideDeck({
      theme,
      detailLevel,
      slides: fallbackSlides,
    }),
    providerUsed: 'deterministic-fallback',
  };
}
