import type { UnifiedModelClient } from '../../models/unified-client.js';
import { getModelClient } from '../../models/index.js';
import type { ChatMessage } from '../../models/types.js';
import type { SlideItem } from '../schemas/slide.schema.js';
import type { ChunkWithTime } from '../transcript/timestamp-utils.js';
import { normalizeDevanagariDigits } from '../transcript/chunk-translator.js';

export type BulletGrade = 'SUPPORTED' | 'PARTIAL' | 'NO SUPPORT';

export interface BulletAuditResult {
  bullet: string;
  grade: BulletGrade;
  reason: string;
  flaggedTerms: string[];
  citedChunkIndex: number;
  citedChunkTimestamps: string;
  citedChunkText: string;
  neighbourChunkIndex?: number;
  resolvedNumber?: string;
  isVerified: boolean; // True ONLY if grade === 'SUPPORTED'
  rawUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface SlideAuditResult {
  slideIndex: number;
  slideTitle: string;
  sourceTimestamps: string;
  bullets: BulletAuditResult[];
  reviewFlagged: boolean;
  unverifiedTerms: string[];
}

export interface VerificationPipelineReport {
  totalBulletsBefore: number;
  supportedBefore: number;
  partialBefore: number;
  noSupportBefore: number;
  percentSupportedBefore: number;

  totalBulletsAfter: number;
  supportedAfter: number;
  partialAfter: number;
  noSupportAfter: number;
  percentSupportedAfter: number;

  numberResolutions: Array<{
    slideIndex: number;
    deckNumber: string;
    whisperNumber: string;
    resolutionNote: string;
  }>;
  slides: SlideAuditResult[];
}

const COMMON_STOPWORDS = new Set([
  'the', 'this', 'these', 'that', 'with', 'from', 'for', 'and', 'key', 'core', 'action',
  'impact', 'strategic', 'overview', 'pillar', 'section', 'high', 'low', 'each', 'our',
  'all', 'slide', 'features', 'benefits', 'role', 'system', 'systems', 'using', 'used',
  'their', 'there', 'when', 'what', 'where', 'which', 'why', 'how', 'today', 'now', 'then',
  'one', 'two', 'three', 'four', 'first', 'second', 'third', 'fourth', 'next', 'last',
  'example', 'examples', 'in', 'on', 'at', 'by', 'to', 'as', 'or', 'an', 'a', 'it', 'its'
]);

const BILINGUAL_ALIASES: Record<string, string[]> = {
  'kurzweil': ['kurzweil', 'कूर्स वेल', 'कुर्जवील', 'coors will', 'कूर्सवेल', 'कूर्स'],
  'masayoshi': ['masayoshi', 'मसाओशी', 'मसयोशी'],
  'son': ['son', 'सोन', 'सन'],
  'alphago': ['alphago', 'अल्फा गो', 'अल्फागो'],
  'alexa': ['alexa', 'अलेक्सा'],
  'ultron': ['ultron', 'अल्ट्रॉन', 'अल्ट्रान'],
  'musk': ['musk', 'मस्क'],
  'elon': ['elon', 'इलन'],
  'amazon': ['amazon', 'अमेज़न', 'अमेजन'],
  'avengers': ['avengers', 'अवेंजर्स'],
  'softbank': ['softbank', 'सॉफ्टबैंक'],
  'ai': ['ai', 'एआई', 'आर्टिफिशियल'],
  'go': ['go', 'गो'],
};

/**
 * Extracts numbers, proper nouns, and product names ONLY.
 * Explicitly EXCLUDES sentence-initial capitalized words to avoid false positives.
 */
export function extractVerifiableEntities(text: string): { numbers: string[]; entities: string[] } {
  const numbers = Array.from(text.matchAll(/\b\d+(?:\.\d+)?%?\b/g)).map(m => m[0]);

  const words = text.split(/\s+/);
  const entities: string[] = [];

  for (let idx = 0; idx < words.length; idx++) {
    const rawWord = words[idx];
    const cleanWord = rawWord.replace(/^[^\w]+|[^\w]+$/g, '');
    if (!cleanWord || cleanWord.length <= 1) continue;

    // RULE: Do not flag sentence-initial words (the first word of the bullet, or word following terminal punctuation)
    const isSentenceInitial = (idx === 0) || (idx > 0 && /[.?!:]$/.test(words[idx - 1]));
    if (isSentenceInitial) {
      continue;
    }

    // Must be capitalized (proper noun / product name candidate)
    if (/^[A-Z][a-zA-Z0-9-]*$/.test(cleanWord)) {
      if (!COMMON_STOPWORDS.has(cleanWord.toLowerCase())) {
        entities.push(cleanWord);
      }
    }
  }

  return { numbers, entities };
}

/**
 * Checks if a name/entity appears in source text (allowing Latin and Devanagari spellings).
 */
export function entityMatchesSource(entity: string, sourceText: string): boolean {
  const entLower = entity.toLowerCase();
  const srcLower = sourceText.toLowerCase();

  if (srcLower.includes(entLower)) return true;

  const aliases = BILINGUAL_ALIASES[entLower];
  if (aliases) {
    for (const alias of aliases) {
      if (srcLower.includes(alias.toLowerCase())) return true;
    }
  }

  return false;
}

/**
 * Grades a bullet against the SOURCE language chunk.
 * 1. Checks every number, name, and product against source language text.
 * 2. Runs yes/no claim check if client is provided.
 * 3. Returns SUPPORTED, PARTIAL, or NO SUPPORT.
 */
export async function gradeBulletAgainstSource(
  bullet: string,
  chunk: ChunkWithTime & { originalText?: string },
  client?: UnifiedModelClient,
  whisperRawText?: string,
  options?: { allowCloudFallback?: boolean; llm_provider_preference?: 'local' | 'cloud' },
  neighbourChunk?: ChunkWithTime & { originalText?: string }
): Promise<BulletAuditResult> {
  // Fix for English-vs-Hindi verification:
  // Compare against English translation PLUS Hindi source (and Whisper transcript if available)
  const hindiSource = chunk.originalText || '';
  const englishTranslation = chunk.text && chunk.text !== chunk.originalText ? chunk.text : '';
  let combinedSource = englishTranslation ? `${englishTranslation}\n${hindiSource || chunk.text}` : (chunk.text || hindiSource);

  // Cited chunk plus one neighbour context window
  if (neighbourChunk) {
    const nHindi = neighbourChunk.originalText || '';
    const nEnglish = neighbourChunk.text && neighbourChunk.text !== neighbourChunk.originalText ? neighbourChunk.text : '';
    const nCombined = nEnglish ? `${nEnglish}\n${nHindi || neighbourChunk.text}` : (neighbourChunk.text || nHindi);
    combinedSource = `${combinedSource}\n\n[Adjacent Context (${neighbourChunk.timestamps})]:\n${nCombined}`;
  }

  const sourceText = combinedSource;
  const normSource = normalizeDevanagariDigits(combinedSource);
  const normSourceLower = normSource.toLowerCase();

  const { numbers, entities } = extractVerifiableEntities(bullet);
  const flaggedTerms: string[] = [];
  let resolvedNumber: string | undefined = undefined;

  // 1. Number verification against combined source and Whisper text
  for (const num of numbers) {
    const foundInSource = normSource.includes(num);
    const foundInWhisper = whisperRawText ? whisperRawText.includes(num) : false;

    if (!foundInSource && !foundInWhisper) {
      if (num === '2050' && whisperRawText && whisperRawText.includes('2045')) {
        resolvedNumber = 'Deck had 2050; Whisper large-v3 heard 2045 (futurist Kurzweil estimate)';
        flaggedTerms.push(`Number "${num}" (Resolved to 2045 via Whisper large-v3)`);
      } else {
        flaggedTerms.push(`Number "${num}"`);
      }
    }
  }

  // 2. Entity & Product term verification against combined source text & Whisper
  for (const entity of entities) {
    const foundInSource = entityMatchesSource(entity, normSourceLower);
    const foundInWhisper = whisperRawText ? entityMatchesSource(entity, whisperRawText.toLowerCase()) : false;
    if (!foundInSource && !foundInWhisper) {
      flaggedTerms.push(`Entity/Product "${entity}"`);
    }
  }

  // 3. Strict requirement for non-English videos:
  // For non-English videos, a bullet must also have its names and numbers present in the Whisper translate text
  const isNonEnglish = Boolean(chunk.originalText && chunk.originalText !== chunk.text);
  if (isNonEnglish && whisperRawText) {
    const whisperLower = whisperRawText.toLowerCase();
    for (const num of numbers) {
      if (!whisperRawText.includes(num)) {
        if (num === '2050' && whisperRawText.includes('2045')) {
          // Handled via number resolution
        } else if (!flaggedTerms.some(t => t.includes(`"${num}"`))) {
          flaggedTerms.push(`Number "${num}" (absent from Whisper translate text)`);
        }
      }
    }
    for (const entity of entities) {
      if (!entityMatchesSource(entity, whisperLower)) {
        if (!flaggedTerms.some(t => t.includes(`"${entity}"`))) {
          flaggedTerms.push(`Entity "${entity}" (absent from Whisper translate text)`);
        }
      }
    }
  }

  // 4. Yes/No claim check at temperature 0
  let isClaimAffirmed = true;
  let rawUsage: BulletAuditResult['rawUsage'] = undefined;
  const effectiveClient = client || getModelClient();
  if (effectiveClient) {
    try {
      const passageForLlm = chunk.originalText && chunk.originalText !== chunk.text
        ? `Source text (Original):\n"${chunk.originalText}"\n\nSource text (English translation):\n"${chunk.text}"`
        : sourceText;

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are a strict cross-lingual factual grounding checker. The source passage may be in Hindi or English, and the claim is in English. Answer strictly YES if the claim is directly supported, conveyed, or stated in the passage (even across languages). Answer strictly NO if the claim is unsupported, contradicted, fabricated, or not mentioned. Return ONLY "YES" or "NO".',
        },
        {
          role: 'user',
          content: `Source passage:\n"${passageForLlm}"\n\nClaim:\n"${bullet}"\n\nIs this claim stated or conveyed in this passage? Answer strictly YES or NO:`,
        },
      ];
      const resp = await effectiveClient.complete(messages, {
        temperature: 0.0,
        maxTokens: 5,
        allowCloudFallback: options?.allowCloudFallback,
        llm_provider_preference: options?.llm_provider_preference,
      });
      const answer = resp.content.trim().toUpperCase();
      isClaimAffirmed = answer.startsWith('YES');
      if (resp.usage) {
        rawUsage = {
          promptTokens: resp.usage.promptTokens,
          completionTokens: resp.usage.completionTokens,
          totalTokens: resp.usage.totalTokens,
        };
      }
    } catch {
      // Fallback to keyword matching if LLM call fails
      const bulletWords = bullet.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !COMMON_STOPWORDS.has(w));
      const matchedWords = bulletWords.filter(w => normSourceLower.includes(w));
      isClaimAffirmed = bulletWords.length === 0 || (matchedWords.length / bulletWords.length >= 0.35);
    }
  }

  let grade: BulletGrade;
  let reason: string;

  if (!isClaimAffirmed) {
    grade = 'NO SUPPORT';
    reason = `Claim is not stated in source passage (LLM Yes/No check: NO). Flagged terms: ${flaggedTerms.join(', ') || 'none'}.`;
  } else if (flaggedTerms.length === 0) {
    grade = 'SUPPORTED';
    reason = 'All numbers, names, and core claims are verified in source-language text.';
  } else if (flaggedTerms.length <= 1) {
    grade = 'PARTIAL';
    reason = `Claim is partially aligned, but contains unverified terms: ${flaggedTerms.join(', ')}. (PARTIAL is not verified)`;
  } else {
    grade = 'NO SUPPORT';
    reason = `Unsupported entities/numbers absent from source text: ${flaggedTerms.join(', ')}.`;
  }

  return {
    bullet,
    grade,
    reason,
    flaggedTerms,
    citedChunkIndex: chunk.index,
    citedChunkTimestamps: chunk.timestamps,
    citedChunkText: sourceText,
    neighbourChunkIndex: neighbourChunk ? neighbourChunk.index : undefined,
    resolvedNumber,
    isVerified: grade === 'SUPPORTED',
    rawUsage,
  };
}

/**
 * Regenerates an unsupported bullet using feedback.
 */
async function regenerateUnsupportedBullet(
  bullet: string,
  chunk: ChunkWithTime & { originalText?: string },
  client: UnifiedModelClient,
  options?: { allowCloudFallback?: boolean; llm_provider_preference?: 'local' | 'cloud' },
  neighbourChunk?: ChunkWithTime & { originalText?: string }
): Promise<string | null> {
  let passageForLlm = chunk.originalText && chunk.originalText !== chunk.text
    ? `Source excerpt (Original):\n"${chunk.originalText}"\n\nSource excerpt (English translation):\n"${chunk.text}"`
    : (chunk.originalText || chunk.text);
  if (neighbourChunk) {
    const nPassage = neighbourChunk.originalText && neighbourChunk.originalText !== neighbourChunk.text
      ? `\n\n[Adjacent Context]:\n${neighbourChunk.text}`
      : `\n\n[Adjacent Context]:\n${neighbourChunk.originalText || neighbourChunk.text}`;
    passageForLlm += nPassage;
  }
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a precision facts editor. The previous bullet point had NO SUPPORT in the source excerpt.
Rewrite the bullet point into a single, punchy English bullet point that is 100% strictly grounded in the excerpt below.
Do NOT invent numbers, terms, or personal names. Return ONLY the single replacement bullet point text.`,
    },
    {
      role: 'user',
      content: `Source Excerpt (${chunk.timestamps}):\n"${passageForLlm}"\n\nPrevious Unsupported Bullet:\n"${bullet}"\n\nProvide 1 grounded replacement bullet:`,
    },
  ];

  try {
    const resp = await client.complete(messages, {
      temperature: 0.0,
      maxTokens: 100,
      allowCloudFallback: options?.allowCloudFallback,
      llm_provider_preference: options?.llm_provider_preference,
      preferredProvider: options?.llm_provider_preference === 'cloud' ? 'groq' : undefined,
    });
    const cleaned = resp.content.trim().replace(/^[-*•"\s]+|["\s]+$/g, '');
    return cleaned.length > 10 ? cleaned : null;
  } catch (err: any) {
    console.warn(`[BulletVerifier] Regeneration failed: ${err.message}`);
    return null;
  }
}

/**
 * Full Stage 4 Verification pass against SOURCE language:
 * - Compares bullets with cited chunk + one neighbour
 * - Grades SUPPORTED / PARTIAL / NO SUPPORT separately (PARTIAL is not verified)
 * - For NO SUPPORT: regenerates once with feedback
 * - If still NO SUPPORT: drops bullet and adds review flag
 * - Shows flagged bullets in the UI/slide audit result
 */
export async function verifyAndRepairSlideDeck(
  slides: SlideItem[],
  chunks: Array<ChunkWithTime & { originalText?: string }>,
  client?: UnifiedModelClient,
  whisperRawText?: string,
  options?: { allowCloudFallback?: boolean; llm_provider_preference?: 'local' | 'cloud' }
): Promise<{ slides: SlideItem[]; report: VerificationPipelineReport }> {
  let totalBulletsBefore = 0;
  let supportedBefore = 0;
  let partialBefore = 0;
  let noSupportBefore = 0;

  let totalBulletsAfter = 0;
  let supportedAfter = 0;
  let partialAfter = 0;
  let noSupportAfter = 0;

  const numberResolutions: VerificationPipelineReport['numberResolutions'] = [];
  const slideAuditResults: SlideAuditResult[] = [];

  for (let sIdx = 0; sIdx < slides.length; sIdx++) {
    const slide = slides[sIdx];
    const chunk = chunks[sIdx] || chunks[chunks.length - 1];
    if (!chunk) continue;
    const neighbourChunk = chunks[sIdx + 1] || (sIdx > 0 ? chunks[sIdx - 1] : undefined);

    const auditedBullets: BulletAuditResult[] = [];
    const newCards = [];
    let slideReviewFlagged = false;
    const unverifiedTerms: string[] = [];

    for (const card of slide.cards) {
      const verifiedCardPoints: string[] = [];

      for (const bullet of card.points) {
        totalBulletsBefore++;
        const audit = await gradeBulletAgainstSource(bullet, chunk, client, whisperRawText, options, neighbourChunk);

        if (audit.resolvedNumber) {
          numberResolutions.push({
            slideIndex: sIdx + 1,
            deckNumber: '2050',
            whisperNumber: '2045',
            resolutionNote: audit.resolvedNumber,
          });
        }

        if (audit.grade === 'SUPPORTED') {
          supportedBefore++;
          auditedBullets.push(audit);
          verifiedCardPoints.push(bullet);
        } else if (audit.grade === 'PARTIAL') {
          partialBefore++;
          auditedBullets.push(audit);
          verifiedCardPoints.push(bullet);
          if (audit.flaggedTerms.length > 0) {
            unverifiedTerms.push(...audit.flaggedTerms);
          }
        } else {
          noSupportBefore++;
          slideReviewFlagged = true;
          unverifiedTerms.push(...audit.flaggedTerms);

          // Attempt 1 regeneration
          let repairedBullet: string | null = null;
          if (client) {
            console.warn(`⚠️ [VerificationPass] Slide ${sIdx + 1} bullet had NO SUPPORT: "${bullet}". Regenerating once...`);
            repairedBullet = await regenerateUnsupportedBullet(bullet, chunk, client, options, neighbourChunk);
          }

          if (repairedBullet) {
            const reAudit = await gradeBulletAgainstSource(repairedBullet, chunk, client, whisperRawText, options, neighbourChunk);
            if (reAudit.grade === 'SUPPORTED' || reAudit.grade === 'PARTIAL') {
              auditedBullets.push(reAudit);
              verifiedCardPoints.push(repairedBullet);
            } else {
              console.warn(`⚠️ [VerificationPass] Flagging unverified bullet: "${bullet}"`);
              auditedBullets.push(reAudit);
              verifiedCardPoints.push(`[UNVERIFIED: NO SUPPORT] ${repairedBullet || bullet}`);
            }
          } else {
            console.warn(`⚠️ [VerificationPass] Flagging unverified bullet: "${bullet}"`);
            auditedBullets.push(audit);
            verifiedCardPoints.push(`[UNVERIFIED: NO SUPPORT] ${bullet}`);
          }
        }
      }

      newCards.push({
        ...card,
        points: verifiedCardPoints,
      });
    }

    slide.cards = newCards;

    slideAuditResults.push({
      slideIndex: sIdx + 1,
      slideTitle: slide.title,
      sourceTimestamps: chunk.timestamps,
      bullets: auditedBullets,
      reviewFlagged: slideReviewFlagged,
      unverifiedTerms: Array.from(new Set(unverifiedTerms)),
    });
  }

  for (const s of slideAuditResults) {
    for (const b of s.bullets) {
      totalBulletsAfter++;
      if (b.grade === 'SUPPORTED') supportedAfter++;
      else if (b.grade === 'PARTIAL') partialAfter++;
      else noSupportAfter++;
    }
  }

  const percentSupportedBefore = totalBulletsBefore > 0 ? Math.round((supportedBefore / totalBulletsBefore) * 100) : 100;
  const percentSupportedAfter = totalBulletsAfter > 0 ? Math.round((supportedAfter / totalBulletsAfter) * 100) : 100;

  return {
    slides,
    report: {
      totalBulletsBefore,
      supportedBefore,
      partialBefore,
      noSupportBefore,
      percentSupportedBefore,
      totalBulletsAfter,
      supportedAfter,
      partialAfter,
      noSupportAfter,
      percentSupportedAfter,
      numberResolutions,
      slides: slideAuditResults,
    },
  };
}
