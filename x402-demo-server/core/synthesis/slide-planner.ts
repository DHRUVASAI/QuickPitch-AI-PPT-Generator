import type { UnifiedModelClient } from '../../models/unified-client.js';
import type { ChatMessage } from '../../models/types.js';
import type { TranscriptData } from '../schemas/transcript.schema.js';
import type { PresentationOutline } from '../schemas/outline.schema.js';
import { type SlideDeck, type SlideItem, type SlideLayoutType, validateSlideDeck } from '../schemas/slide.schema.js';
import { cleanTextForPptx } from '../transcript/sanitizer.js';
import { chunkTranscriptText } from './outline-synthesizer.js';
import { gpuLock } from '../utils/gpu-lock.js';

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

function buildFallbackNLPDeck(
  transcript: TranscriptData,
  targetCount: number,
  isPartial: boolean = true,
  bulletsPerSlide: number = 3,
  wordsPerBullet: number = 15
): SlideItem[] {
  const text = transcript.sanitizedText;
  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 180 && !/^(and|but|or|so|because)/i.test(s));

  const slides: SlideItem[] = [];
  const contentCount = Math.max(2, targetCount - 1);

  for (let i = 0; i < contentCount; i++) {
    const layout = LAYOUT_CYCLE[i % LAYOUT_CYCLE.length];
    const cardPoints: string[] = [];
    for (let p = 0; p < bulletsPerSlide; p++) {
      const sent = sentences[(i * bulletsPerSlide + p) % (sentences.length || 1)] || `Strategic observation and domain analysis point ${p + 1}.`;
      cardPoints.push(sent);
    }

    slides.push({
      title: `${transcript.title} - Pillar ${i + 1}`,
      subtitle: isPartial ? `[Partial Result] Key insights for section ${i + 1}` : `Key insights for section ${i + 1}`,
      category: `PILLAR 0${i + 1}`,
      layout_type: layout,
      quote: layout === 'hero_quote' ? cardPoints[0] : undefined,
      quote_author: layout === 'hero_quote' ? transcript.title : undefined,
      cards: [
        { card_title: 'Core Findings', points: cardPoints.slice(0, Math.ceil(bulletsPerSlide / 2)) },
        { card_title: 'Execution & Impact', points: cardPoints.slice(Math.ceil(bulletsPerSlide / 2)) },
      ],
      speaker_notes: `Speaker note for Pillar ${i + 1}: Emphasize operational rigor and direct takeaways.`,
    });
  }

  return slides;
}

export interface PlanSlideStructureOptions {
  allowCloudFallback?: boolean;
  outputLanguage?: string;
  targetSlideCount?: number;
  slideCount?: number;
  bulletsPerSlide?: number;
  wordsPerBullet?: number;
  audience?: string;
  tone?: string;
  speakerNotes?: boolean;
  includeAgenda?: boolean;
  includeSummary?: boolean;
  focusText?: string;
}

interface SlideGenResult {
  deck: SlideDeck;
  adjustmentNotice?: string;
}

async function callProviderForSlidesWithEnforcement(
  client: UnifiedModelClient,
  providerName: string,
  systemPrompt: string,
  userPrompt: string,
  theme: string,
  detailLevel: 'concise' | 'balanced' | 'detailed',
  contentSlidesCount: number,
  targetSlideCount: number
): Promise<SlideGenResult> {
  const initialMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const firstAttempt = await client.completeWith(providerName, initialMessages, {
    temperature: 0.25,
    maxTokens: 4000,
    jsonMode: true,
  });

  let rawContent = firstAttempt.content;
  let parsedSlides: any[] = [];
  let parseError: Error | null = null;

  try {
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed.slides)) {
      parsedSlides = parsed.slides;
    }
  } catch (err: any) {
    parseError = err;
    console.warn(`[SlidePlanner: ${providerName}] Initial parse failed: ${err.message}`);
  }

  // Requirement 2: Slide count enforcement
  // If model returns fewer or more slides than requested, retry once with mismatch as feedback
  const countMismatch = !parseError && parsedSlides.length !== contentSlidesCount;
  if (parseError || countMismatch) {
    const feedbackReason = parseError
      ? `failed JSON parsing with error "${parseError.message}"`
      : `returned ${parsedSlides.length} slides, but exactly ${contentSlidesCount} content slides were requested (for a ${targetSlideCount} slide deck)`;

    console.warn(`[SlidePlanner: ${providerName}] Retrying once with count/schema feedback: ${feedbackReason}`);

    const retryMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: rawContent },
      {
        role: 'user',
        content: `Your previous response ${feedbackReason}.
Please correct this and return strictly valid JSON matching the schema with EXACTLY ${contentSlidesCount} slides in the "slides" array.
All content MUST BE IN ENGLISH.`,
      },
    ];

    try {
      const secondAttempt = await client.completeWith(providerName, retryMessages, {
        temperature: 0.15,
        maxTokens: 4000,
        jsonMode: true,
      });

      const match2 = secondAttempt.content.match(/\{[\s\S]*\}/);
      if (match2) {
        const parsed2 = JSON.parse(match2[0]);
        if (Array.isArray(parsed2.slides)) {
          parsedSlides = parsed2.slides;
          parseError = null;
        }
      }
    } catch (retryErr: any) {
      console.warn(`[SlidePlanner: ${providerName}] Retry also failed:`, retryErr.message);
    }
  }

  if (parseError || parsedSlides.length === 0) {
    throw new Error(`Slide generation failed schema validation: ${parseError?.message || 'Empty slides array'}`);
  }

  let adjustmentNotice: string | undefined = undefined;

  // Final count check & adjustment: If still fewer or more, programmatically adjust and tell user
  if (parsedSlides.length !== contentSlidesCount) {
    const originalCount = parsedSlides.length;
    console.warn(`⚠️ [SlideCountEnforcement] Model returned ${originalCount} slides; requested ${contentSlidesCount}. Programmatically adjusting.`);

    if (parsedSlides.length > contentSlidesCount) {
      parsedSlides = parsedSlides.slice(0, contentSlidesCount);
    } else {
      // Append missing slides
      let missingIndex = parsedSlides.length + 1;
      while (parsedSlides.length < contentSlidesCount) {
        parsedSlides.push({
          title: `Key Strategic Pillar ${missingIndex}`,
          subtitle: 'Operational execution and impact considerations',
          category: `PILLAR 0${missingIndex}`,
          layout_type: LAYOUT_CYCLE[(missingIndex - 1) % LAYOUT_CYCLE.length],
          cards: [
            {
              card_title: 'Core Findings',
              points: [
                'Primary strategic takeaway and implementation requirement',
                'Operational efficiency and organizational alignment',
              ],
            },
            {
              card_title: 'Action Item',
              points: ['Actionable milestone to achieve measurable transformation'],
            },
          ],
          speaker_notes: `Speaker note for Pillar ${missingIndex}: Highlight implementation milestones.`,
        });
        missingIndex++;
      }
    }

    adjustmentNotice = `Requested ${targetSlideCount} total slides (${contentSlidesCount} content slides); model generated ${originalCount} slides; adjusted to exactly ${contentSlidesCount} content slides.`;
  }

  const validatedDeck = validateSlideDeck({
    theme,
    detailLevel,
    slides: parsedSlides,
  });

  return {
    deck: validatedDeck,
    adjustmentNotice,
  };
}

export async function planSlideStructure(
  outline: PresentationOutline,
  transcript: TranscriptData,
  client: UnifiedModelClient,
  theme: string = 'cyber-blue',
  detailLevel: 'concise' | 'balanced' | 'detailed' = 'balanced',
  options?: PlanSlideStructureOptions
): Promise<SlideDeck & { providerUsed?: string; adjustmentNotice?: string }> {
  const rawTarget = options?.targetSlideCount || options?.slideCount || outline.targetSlideCount || 7;
  const targetSlideCount = Math.min(30, Math.max(3, rawTarget));
  // Total slides = 1 cover slide + contentSlidesCount
  const contentSlidesCount = Math.max(2, targetSlideCount - 1);

  const bulletsPerSlide = Math.min(8, Math.max(1, options?.bulletsPerSlide || 3));
  const wordsPerBullet = Math.min(35, Math.max(3, options?.wordsPerBullet || 14));
  const audience = options?.audience || 'Executive Leadership';
  const tone = options?.tone || 'Executive Investor Pitch';
  const focus = options?.focusText ? `Special Instructions / Focus Area: ${options.focusText}\n` : '';
  const notesInstruction = options?.speakerNotes
    ? 'For every slide, include a helpful "speaker_notes" field with speaking points for the presenter.'
    : 'Include brief "speaker_notes" for each slide.';

  const agendaInstruction = options?.includeAgenda
    ? 'The FIRST content slide MUST be an AGENDA slide (category: "AGENDA", layout_type: "three_columns") summarizing the core roadmap of the presentation.'
    : '';

  const summaryInstruction = options?.includeSummary
    ? 'The LAST content slide MUST be a SUMMARY / TAKEAWAYS slide (category: "SUMMARY", layout_type: "split_cards") summarizing key takeaways and next steps.'
    : '';

  // Chunked transcript overview
  const chunks = chunkTranscriptText(transcript.sanitizedText, 6000, 300);
  let contextText = '';
  if (chunks.length === 1) {
    contextText = chunks[0];
  } else {
    contextText = chunks.map((c, i) => `[SECTION ${i + 1}/${chunks.length}]:\n${c.slice(0, 3500)}`).join('\n\n');
  }

  const systemPrompt = `You are a world-class presentation structuring engine. Output strictly valid JSON with a "slides" array.
ALL SLIDE TITLES, SUBTITLES, CATEGORY BADGES, CARD TITLES, BULLET POINTS, AND SPEAKER NOTES MUST BE IN ENGLISH.
If the source context is in Hindi, Telugu, or another language, translate all facts accurately into English.`;

  const userPrompt = `Generate EXACTLY ${contentSlidesCount} content slides based on this research outline and source context:

OUTLINE:
Title: ${outline.title}
Subtitle: ${outline.subtitle}
Pillars: ${JSON.stringify(outline.pillars)}
Key Topics: ${outline.keyTopics.join(', ')}

AUDIENCE & TONE:
Target Audience: ${audience}
Presentation Tone: ${tone}
${focus}
CONTENT SPECIFICATIONS:
- Number of Content Slides: EXACTLY ${contentSlidesCount} (No more, no less).
- Bullets Per Slide: Aim for ~${bulletsPerSlide} bullets per card.
- Words Per Bullet: Aim for ~${wordsPerBullet} words per bullet point.
- ${notesInstruction}
${agendaInstruction ? `- ${agendaInstruction}\n` : ''}${summaryInstruction ? `- ${summaryInstruction}\n` : ''}

SOURCE CONTEXT (Topic: "${transcript.title}"):
"${contextText.slice(0, 22000)}"

Generate a JSON object with a "slides" array containing EXACTLY ${contentSlidesCount} objects matching:
{
  "slides": [
    {
      "title": "Clear English Slide Title",
      "subtitle": "Informative subtitle in English",
      "category": "CATEGORY BADGE",
      "layout_type": "split_cards | three_columns | four_columns | hero_quote | stats_spotlight | comparison_split | roadmap_timeline | diagram_flow | data_table | quadrant_grid | outro_slide",
      "speaker_notes": "Key speaker notes for the presenter in English",
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

    if (!allowCloud && provider.isLocal === false) {
      continue;
    }

    try {
      if (await provider.isAvailable()) {
        console.log(`[SynthesisChain: Slides] Trying provider: ${providerName} (target slides: ${contentSlidesCount})...`);

        let genResult: SlideGenResult;
        if (providerName === 'ollama') {
          const releaseGpu = await gpuLock.acquire('Ollama-Slides');
          try {
            genResult = await callProviderForSlidesWithEnforcement(
              client,
              providerName,
              systemPrompt,
              userPrompt,
              theme,
              detailLevel,
              contentSlidesCount,
              targetSlideCount
            );
          } finally {
            releaseGpu();
          }
        } else {
          genResult = await callProviderForSlidesWithEnforcement(
            client,
            providerName,
            systemPrompt,
            userPrompt,
            theme,
            detailLevel,
            contentSlidesCount,
            targetSlideCount
          );
        }

        console.log(`✓ [SynthesisChain: Slides] Provider "${providerName}" produced ${genResult.deck.slides.length} slides`);
        return {
          ...genResult.deck,
          providerUsed: providerName,
          adjustmentNotice: genResult.adjustmentNotice,
        };
      }
    } catch (err: any) {
      console.warn(`[SynthesisChain: Slides] Provider "${providerName}" failed:`, err.message);
    }
  }

  // Chain 3: Partial Deterministic NLP Deck
  console.warn('⚠️ [SynthesisChain: Slides] Local provider failed. Building deterministic fallback deck.');
  const fallbackSlides = buildFallbackNLPDeck(transcript, targetSlideCount, true, bulletsPerSlide, wordsPerBullet).map((s, idx) => ({
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
    adjustmentNotice: `Compiled fallback deck with ${fallbackSlides.length} content slides.`,
  };
}
