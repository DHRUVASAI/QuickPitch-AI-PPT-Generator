import type { Context } from 'hono';
import { getModelClient } from '../models/index.js';
import {
  extractTranscript,
  synthesizeOutline,
  planSlideStructure,
  compilePptx,
  validateSlideDeck,
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
      allow_cloud_fallback,
      output_language = 'same as video',
    } = body;

    const allowCloudFallback = allow_cloud_fallback === true || process.env.ALLOW_CLOUD_FALLBACK === 'true';
    const modelClient = getModelClient();
    let isPartial = false;
    let partialNotice = '';

    // Stage 1: Transcript Ingestion & Sanitization
    console.log(`[QuickPitch Stage 1] Ingesting source (type: ${source_type}, cloudFallback: ${allowCloudFallback}, outputLang: ${output_language})...`);
    let transcriptData;
    try {
      transcriptData = await extractTranscript({
        sourceType: source_type,
        url,
        text,
        topicHint: text ? text.slice(0, 60) : undefined,
      }, { allowCloudFallback, outputLanguage: output_language });
      if (transcriptData.metadata?.partial) {
        isPartial = true;
        partialNotice = 'Transcript used partial video metadata';
      }
    } catch (err: any) {
      console.warn('⚠️ [QuickPitch Stage 1] Transcript extraction encountered error, using safe partial fallback:', err.message);
      isPartial = true;
      partialNotice = `Transcript extraction error: ${err.message}`;
      transcriptData = {
        sourceType: source_type as any,
        title: url || 'Presentation Subject',
        rawText: `[Partial Source]: ${text || url || 'Executive Analysis'}`,
        sanitizedText: text || url || 'Executive Analysis and Insights',
        charCount: (text || url || '').length,
        metadata: { partial: true },
      };
    }

    console.log(`✓ Transcript ready: "${transcriptData.title}" (${transcriptData.charCount} chars, detectedLang: ${transcriptData.metadata?.detectedLanguage || 'unknown'})`);

    // Stage 2: Synthesis & Outline Planning (with schema validation & retry-on-failure)
    console.log(`[QuickPitch Stage 2] Synthesizing outline (outputLanguage: "${output_language}")...`);
    const outline = await synthesizeOutline(transcriptData, modelClient, detail_level, {
      allowCloudFallback,
      outputLanguage: output_language,
    });
    if (outline.rawSynthesis?.includes('Partial Result')) {
      isPartial = true;
      partialNotice = 'Model synthesis used deterministic fallback';
    }

    const slideDeck = await planSlideStructure(
      outline,
      transcriptData,
      modelClient,
      theme,
      detail_level,
      { allowCloudFallback, outputLanguage: output_language }
    );

    const providerUsed = slideDeck.providerUsed || outline.providerUsed || 'ollama';

    // Stage 3: Slide Compilation (.pptx)
    console.log(`[QuickPitch Stage 3] Compiling native PowerPoint deck (Theme: ${slideDeck.theme}, Provider: ${providerUsed})...`);
    let pptxResult;
    try {
      pptxResult = await compilePptx(slideDeck, theme, transcriptData.sanitizedText);
    } catch (compileErr: any) {
      console.warn('⚠️ [QuickPitch Stage 3] Primary slide compilation error, building safe recovery deck:', compileErr.message);
      isPartial = true;
      partialNotice = 'Compiled via recovery slide generator';

      const safeDeck = validateSlideDeck({
        theme: 'cyber-blue',
        detailLevel: 'balanced',
        slides: [
          {
            title: transcriptData.title,
            subtitle: '[Notice: Partial Recovery Presentation]',
            category: 'RECOVERY DECK',
            cards: [
              { card_title: 'Source Overview', points: [transcriptData.sanitizedText.slice(0, 200)] },
              { card_title: 'Notice', points: ['Presentation compiled in safe recovery mode.'] },
            ],
          },
        ],
      });
      pptxResult = await compilePptx(safeDeck, 'cyber-blue');
    }

    console.log(`✅ Success! Returning ${pptxResult.fileName} (${pptxResult.buffer.length} bytes) ${isPartial ? '[PARTIAL]' : '[COMPLETE]'} (Provider: ${providerUsed})`);

    return new Response(pptxResult.buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${pptxResult.fileName}"`,
        'X-QuickPitch-Status': isPartial ? 'partial' : 'complete',
        'X-QuickPitch-Provider': providerUsed,
        ...(isPartial ? { 'X-QuickPitch-Notice': partialNotice } : {}),
      },
    });
  } catch (error: any) {
    // Ultimate safety: return a clear JSON message with partial details rather than a blank 500 crash
    console.error('[QuickPitch] Generate PPT Error:', error);
    return c.json({
      status: 'partial_error',
      message: 'Presentation request encountered an issue but was caught safely by our resilience layer.',
      error: error.message || 'Internal Server Error',
      hint: 'You can retry with direct text prompt or check Ollama / Groq status.',
    }, 200);
  }
}
