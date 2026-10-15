import type { UnifiedModelClient } from '../../models/unified-client.js';
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

export async function synthesizeOutline(
  transcript: TranscriptData,
  client: UnifiedModelClient,
  detailLevel: string = 'balanced'
): Promise<PresentationOutline> {
  const targetCount = calculateSlideCount(transcript.charCount, detailLevel);
  const cleanContext = transcript.sanitizedText.slice(0, 14000);

  const synthesisPrompt = `You are a master presentation research analyst and domain strategist.
Extract a comprehensive, factual, topic-grounded research outline from the following content:

SOURCE CONTENT (Topic / Title: "${transcript.title}"):
"${cleanContext}"

══ MANDATORY EXTRACTION INSTRUCTIONS ══
1. 360° SOURCE OVERVIEW (For Cover & Executive Blueprint):
   - Executive Title & Subtitle: A compelling, comprehensive 12–18 word synthesis sentence explaining the entire subject.
   - 4-Pillar Executive Summary: (1) Subject Context, (2) Primary Challenges/Themes, (3) Core Interventions/Perspectives, (4) Ultimate Impact/Outcome.

2. STRICT FACTUAL GROUNDING & ANCHORING:
   - EVERY claim, metric, name, statement, or quote MUST be explicitly anchored in facts present in the source.
   - DO NOT invent artificial statistics, fake percentages, or unverified claims.

3. CONTENT CLASSIFICATION & TOPIC EXTRACTION:
   - Extract 6-8 specific topics discussed with real names, concepts, and takeaways.
   - No generic placeholders like "Theme A" or "Future Scope".

Return the result as JSON matching:
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

  let parsed: any = null;
  let rawText = '';

  try {
    const res = await client.complete([
      { role: 'system', content: 'You are an executive research analyst. Return strictly valid JSON.' },
      { role: 'user', content: synthesisPrompt },
    ], { temperature: 0.2, maxTokens: 1800, jsonMode: true });

    rawText = res.content;
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    }
  } catch (err: any) {
    console.warn('[SynthesizeOutline] LLM call failed or produced non-JSON, using structured defaults:', err.message);
  }

  return validatePresentationOutline({
    title: parsed?.title || transcript.title,
    subtitle: parsed?.subtitle || 'Executive analysis and strategic takeaways',
    pillars: parsed?.pillars,
    keyTopics: parsed?.keyTopics,
    targetSlideCount: targetCount,
    rawSynthesis: rawText,
  });
}
