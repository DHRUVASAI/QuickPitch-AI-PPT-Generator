import type { UnifiedModelClient } from '../../models/unified-client.js';
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

function buildFallbackNLPDeck(transcript: TranscriptData, targetCount: number): SlideItem[] {
  const text = transcript.sanitizedText;
  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25 && s.length < 180 && !/^(and|but|or|so|because)/i.test(s));

  const slides: SlideItem[] = [];
  const contentCount = Math.max(4, targetCount - 1);

  for (let i = 0; i < contentCount; i++) {
    const layout = LAYOUT_CYCLE[i % LAYOUT_CYCLE.length];
    const s1 = sentences[(i * 3) % (sentences.length || 1)] || 'Strategic observation and findings.';
    const s2 = sentences[(i * 3 + 1) % (sentences.length || 1)] || 'Tactical execution and domain implications.';
    const s3 = sentences[(i * 3 + 2) % (sentences.length || 1)] || 'Key measurable impact and transformation.';

    slides.push({
      title: `${transcript.title} - Pillar ${i + 1}`,
      subtitle: `Key insight analysis for section ${i + 1}`,
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

export async function planSlideStructure(
  outline: PresentationOutline,
  transcript: TranscriptData,
  client: UnifiedModelClient,
  theme: string = 'cyber-blue',
  detailLevel: 'concise' | 'balanced' | 'detailed' = 'balanced'
): Promise<SlideDeck> {
  const targetCount = outline.targetSlideCount || 7;
  const contentSlidesCount = targetCount - 1;

  const prompt = `You are a world-class presentation designer.
Generate exactly ${contentSlidesCount} content slides based on this research outline and source context:

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

  let slides: SlideItem[] = [];

  try {
    const res = await client.complete([
      { role: 'system', content: 'You are a presentation structuring engine. Output strictly valid JSON with a "slides" array.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3, maxTokens: 3500, jsonMode: true });

    const match = res.content.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed.slides) && parsed.slides.length > 0) {
        slides = parsed.slides;
      }
    }
  } catch (err: any) {
    console.warn('[SlidePlanner] LLM generation failed, using intelligent NLP fallback deck:', err.message);
  }

  if (slides.length === 0) {
    slides = buildFallbackNLPDeck(transcript, targetCount);
  }

  // Ensure each slide has a layout_type
  slides = slides.map((s, idx) => ({
    ...s,
    title: cleanTextForPptx(s.title, 60),
    subtitle: cleanTextForPptx(s.subtitle || '', 100),
    category: cleanTextForPptx(s.category || 'STRATEGIC INSIGHT', 30),
    layout_type: s.layout_type || LAYOUT_CYCLE[idx % LAYOUT_CYCLE.length],
  }));

  return validateSlideDeck({
    theme,
    detailLevel,
    slides,
  });
}
