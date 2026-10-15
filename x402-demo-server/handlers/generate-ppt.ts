import type { Context } from 'hono';
import { getModelClient } from '../models/index.js';
import {
  extractTranscript,
  synthesizeOutline,
  planSlideStructure,
  compilePptx,
} from '../core/index.js';

export async function handleGeneratePpt(c: Context) {
  try {
    console.log('\n[QuickPitch] Presentation generation requested...');

    let body = c.get('parsedBody');
    if (!body || typeof body !== 'object') {
      try {
        body = await c.req.json();
      } catch {
        try {
          const rawText = c.get('rawBodyText') || (await c.req.text());
          body = rawText ? JSON.parse(rawText) : {};
        } catch {
          body = {};
        }
      }
    }

    const {
      source_type = 'text',
      url,
      text,
      theme,
      detail_level = 'balanced',
    } = body;

    const modelClient = getModelClient();

    // Stage 1: Transcript Ingestion & Sanitization
    console.log(`[QuickPitch Stage 1] Ingesting source (type: ${source_type})...`);
    const transcriptData = await extractTranscript({
      sourceType: source_type,
      url,
      text,
      topicHint: text ? text.slice(0, 60) : undefined,
    });
    console.log(`✓ Transcript ready: "${transcriptData.title}" (${transcriptData.charCount} chars)`);

    // Stage 2: Synthesis & Outline Planning
    console.log('[QuickPitch Stage 2] Synthesizing executive outline and slide plan...');
    const outline = await synthesizeOutline(transcriptData, modelClient, detail_level);
    console.log(`✓ Outline generated: "${outline.title}" (${outline.targetSlideCount} slides targeted)`);

    const slideDeck = await planSlideStructure(
      outline,
      transcriptData,
      modelClient,
      theme,
      detail_level
    );
    console.log(`✓ Structured ${slideDeck.slides.length} slides with layout archetypes`);

    // Stage 3: Slide Compilation (.pptx)
    console.log(`[QuickPitch Stage 3] Compiling native PowerPoint deck (Theme: ${slideDeck.theme})...`);
    const pptxResult = await compilePptx(slideDeck, theme, transcriptData.sanitizedText);
    console.log(`✅ Success! Returning ${pptxResult.fileName} (${pptxResult.buffer.length} bytes)`);

    return new Response(pptxResult.buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${pptxResult.fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('[QuickPitch] Generate PPT Error:', error);
    return c.json({ error: error.message || 'Internal Server Error' }, 500);
  }
}
