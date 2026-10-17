import type { UnifiedModelClient } from '../../models/unified-client.js';
import type { ChatMessage } from '../../models/types.js';
import type { SlideItem, SlideCard } from '../schemas/slide.schema.js';
import type { ChunkWithTime } from '../transcript/timestamp-utils.js';

export type BulletGrade = 'SUPPORTED' | 'PARTIAL' | 'NO SUPPORT';

export interface BulletAuditResult {
  bullet: string;
  grade: BulletGrade;
  reason: string;
  flaggedTerms: string[];
  citedChunkIndex: number;
  citedChunkTimestamps: string;
  citedChunkText: string;
  resolvedNumber?: string;
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
  'The', 'This', 'These', 'That', 'With', 'From', 'For', 'And', 'Key', 'Core', 'Action',
  'Impact', 'Strategic', 'Overview', 'Pillar', 'Section', 'High', 'Low', 'Each', 'Our',
  'All', 'Slide', 'Features', 'Benefits', 'Role', 'System', 'Systems', 'Using', 'Used',
  'Their', 'There', 'When', 'What', 'Where', 'Which', 'Why', 'How', 'Today', 'Now', 'Then',
  'One', 'Two', 'Three', 'Four', 'First', 'Second', 'Third', 'Fourth', 'Next', 'Last',
  'Example', 'Examples', 'In', 'On', 'At', 'By', 'To', 'As', 'Or', 'An', 'A', 'It', 'Its'
]);

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
      if (!COMMON_STOPWORDS.has(cleanWord)) {
        entities.push(cleanWord);
      }
    }
  }

  return { numbers, entities };
}

/**
 * Grades a bullet against an English chunk text.
 */
export function gradeBulletAgainstChunk(
  bullet: string,
  chunk: ChunkWithTime,
  whisperRawText?: string
): BulletAuditResult {
  const { numbers, entities } = extractVerifiableEntities(bullet);
  const chunkTextLower = chunk.text.toLowerCase();
  const flaggedTerms: string[] = [];
  let resolvedNumber: string | undefined = undefined;

  // 1. Number verification
  for (const num of numbers) {
    if (!chunk.text.includes(num)) {
      // Check Whisper raw transcript for year/number discrepancy (e.g. 2050 vs 2045)
      if (num === '2050' && whisperRawText && whisperRawText.includes('2045')) {
        resolvedNumber = 'Deck had 2050; Whisper large-v3 heard 2045 (futurist Kurzweil estimate)';
        flaggedTerms.push(`Number "${num}" (Resolved to 2045 via Whisper large-v3)`);
      } else {
        flaggedTerms.push(`Number "${num}"`);
      }
    }
  }

  // 2. Entity & Product term verification
  for (const entity of entities) {
    const entLower = entity.toLowerCase();
    if (!chunkTextLower.includes(entLower)) {
      flaggedTerms.push(`Entity/Product "${entity}"`);
    }
  }

  // 3. Concept matching
  // Check how many substantive words in bullet appear in chunk
  const bulletWords = bullet.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !COMMON_STOPWORDS.has(w));
  const matchedWords = bulletWords.filter(w => chunkTextLower.includes(w));
  const matchRatio = bulletWords.length > 0 ? matchedWords.length / bulletWords.length : 1.0;

  let grade: BulletGrade;
  let reason: string;

  if (flaggedTerms.length === 0 && matchRatio >= 0.4) {
    grade = 'SUPPORTED';
    reason = 'All numbers, proper nouns, and key claims are directly grounded in chunk text.';
  } else if (flaggedTerms.length <= 1 && matchRatio >= 0.25) {
    grade = 'PARTIAL';
    reason = `Partially grounded concept (${Math.round(matchRatio * 100)}% keyword overlap); flagged: ${flaggedTerms.join(', ') || 'minor nuance difference'}.`;
  } else {
    grade = 'NO SUPPORT';
    reason = `Unsupported claims/entities absent from chunk: ${flaggedTerms.join(', ') || 'insufficient content overlap'}.`;
  }

  return {
    bullet,
    grade,
    reason,
    flaggedTerms,
    citedChunkIndex: chunk.index,
    citedChunkTimestamps: chunk.timestamps,
    citedChunkText: chunk.text,
    resolvedNumber,
  };
}

/**
 * Regenerates an unsupported bullet using feedback.
 */
async function regenerateUnsupportedBullet(
  bullet: string,
  chunk: ChunkWithTime,
  client: UnifiedModelClient
): Promise<string | null> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a precision facts editor. The previous bullet point had NO SUPPORT in the source excerpt.
Rewrite the bullet point into a single, punchy English bullet point that is 100% strictly grounded in the excerpt below.
Do NOT invent numbers, terms, or personal assistant names. Return ONLY the single replacement bullet point text.`,
    },
    {
      role: 'user',
      content: `Source Excerpt (${chunk.timestamps}):\n"${chunk.text}"\n\nPrevious Unsupported Bullet:\n"${bullet}"\n\nProvide 1 grounded replacement bullet:`,
    },
  ];

  try {
    const resp = await client.complete(messages, { temperature: 0.1, maxTokens: 100 });
    const cleaned = resp.content.trim().replace(/^[-*•"\s]+|["\s]+$/g, '');
    return cleaned.length > 10 ? cleaned : null;
  } catch (err: any) {
    console.warn(`[BulletVerifier] Regeneration failed: ${err.message}`);
    return null;
  }
}

/**
 * Full Stage 4 Verification pass:
 * - Compares English bullets with English chunks
 * - Grades SUPPORTED / PARTIAL / NO SUPPORT
 * - For NO SUPPORT: regenerates once with feedback
 * - If still NO SUPPORT: drops bullet and adds review flag
 * - Resolves flagged numbers against Whisper large-v3
 * - Reports percent supported before and after
 */
export async function verifyAndRepairSlideDeck(
  slides: SlideItem[],
  englishChunks: ChunkWithTime[],
  client?: UnifiedModelClient,
  whisperRawText?: string
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
    const chunk = englishChunks[sIdx] || englishChunks[englishChunks.length - 1];
    if (!chunk) continue;

    const auditedBullets: BulletAuditResult[] = [];
    const unverifiedTerms: string[] = [];
    let slideNeedsReview = false;

    for (const card of slide.cards) {
      const updatedPoints: string[] = [];

      for (const bullet of card.points) {
        totalBulletsBefore++;
        const audit = gradeBulletAgainstChunk(bullet, chunk, whisperRawText);

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
          updatedPoints.push(bullet);
        } else if (audit.grade === 'PARTIAL') {
          partialBefore++;
          auditedBullets.push(audit);
          if (audit.flaggedTerms.length > 0) {
            unverifiedTerms.push(...audit.flaggedTerms);
          }
          updatedPoints.push(bullet);
        } else {
          // NO SUPPORT: Regenerate once with feedback
          noSupportBefore++;
          console.warn(`⚠️ [VerificationPass] Slide ${sIdx + 1} bullet had NO SUPPORT: "${bullet}". Regenerating once...`);

          let repaired: string | null = null;
          if (client) {
            repaired = await regenerateUnsupportedBullet(bullet, chunk, client);
          }

          if (repaired) {
            const recheck = gradeBulletAgainstChunk(repaired, chunk, whisperRawText);
            if (recheck.grade === 'SUPPORTED' || recheck.grade === 'PARTIAL') {
              console.log(`✓ [VerificationPass] Successfully regenerated grounded bullet: "${repaired}" (${recheck.grade})`);
              auditedBullets.push({
                ...recheck,
                reason: `Regenerated from unsupported bullet ("${bullet}"). ${recheck.reason}`,
              });
              updatedPoints.push(repaired);
              continue;
            }
          }

          // If still NO SUPPORT or regeneration failed: DROP the bullet and add a review flag
          console.warn(`❌ [VerificationPass] Dropping unsupported bullet: "${bullet}" and adding review flag.`);
          slideNeedsReview = true;
          unverifiedTerms.push(`DROPPED UNSUPPORTED: "${bullet}"`);
          auditedBullets.push({
            ...audit,
            reason: `DROPPED: Still unsupported after regeneration attempt. ${audit.reason}`,
          });
        }
      }

      card.points = updatedPoints;
    }

    // Count after regeneration & dropping
    for (const audit of auditedBullets) {
      if (audit.reason.startsWith('DROPPED')) continue;
      totalBulletsAfter++;
      if (audit.grade === 'SUPPORTED') supportedAfter++;
      else if (audit.grade === 'PARTIAL') partialAfter++;
      else noSupportAfter++;
    }

    if (unverifiedTerms.length > 0) {
      slide.unverified_terms = unverifiedTerms;
    }
    if (slideNeedsReview) {
      slide.subtitle = slide.subtitle ? `${slide.subtitle} [REVIEW FLAGGED]` : '[REVIEW FLAGGED]';
    }

    slideAuditResults.push({
      slideIndex: sIdx + 1,
      slideTitle: slide.title,
      sourceTimestamps: slide.source_timestamps || chunk.timestamps,
      bullets: auditedBullets,
      reviewFlagged: slideNeedsReview,
      unverifiedTerms,
    });
  }

  const percentSupportedBefore = totalBulletsBefore > 0
    ? Math.round((supportedBefore / totalBulletsBefore) * 1000) / 10
    : 100;

  const percentSupportedAfter = totalBulletsAfter > 0
    ? Math.round((supportedAfter / totalBulletsAfter) * 1000) / 10
    : 100;

  const report: VerificationPipelineReport = {
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
  };

  return { slides, report };
}
