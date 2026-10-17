import type { UnifiedModelClient } from '../../models/unified-client.js';
import type { ChatMessage } from '../../models/types.js';
import type { ChunkWithTime } from './timestamp-utils.js';

export interface TranslatedChunk extends ChunkWithTime {
  originalText: string;
}

/**
 * Translates each transcript chunk into English while preserving its exact
 * timestamps (startSec, endSec, MM:SS label) and index.
 * Caches originalText and sets text to the clean English translation.
 */
export async function translateChunksToEnglish(
  chunks: ChunkWithTime[],
  client: UnifiedModelClient,
  sourceLanguage: string = 'auto'
): Promise<TranslatedChunk[]> {
  const normLang = (sourceLanguage || 'auto').toLowerCase().trim();
  if (normLang === 'en' || normLang === 'english') {
    return chunks.map((c) => ({
      ...c,
      originalText: c.text,
    }));
  }

  const translated: TranslatedChunk[] = [];

  for (const chunk of chunks) {
    if (!chunk.text || !chunk.text.trim()) {
      translated.push({
        ...chunk,
        originalText: chunk.text,
      });
      continue;
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert factual translator. Translate the following transcript excerpt accurately into clear, direct English.
CRITICAL REQUIREMENTS:
- Output ONLY the plain English translation of the speech excerpt. No conversational commentary, preamble, or quotation marks.
- Faithfully preserve all factual details, names, technical terms, and numeric values.
- Do NOT hallucinate or add facts from outside the excerpt.`,
      },
      {
        role: 'user',
        content: `Source Excerpt (${chunk.timestamps}):\n"${chunk.text}"`,
      },
    ];

    try {
      const response = await client.complete(messages, {
        temperature: 0.1,
        maxTokens: 1500,
      });

      const cleanText = response.content.trim().replace(/^["']|["']$/g, '').trim();

      translated.push({
        ...chunk,
        originalText: chunk.text,
        text: cleanText.length > 0 ? cleanText : chunk.text,
      });
    } catch (err: any) {
      console.warn(`[ChunkTranslator] Translation failed for chunk ${chunk.index}: ${err.message}. Preserving original.`);
      translated.push({
        ...chunk,
        originalText: chunk.text,
      });
    }
  }

  return translated;
}
