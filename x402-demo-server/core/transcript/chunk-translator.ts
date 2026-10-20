import type { UnifiedModelClient } from '../../models/unified-client.js';
import type { ChatMessage } from '../../models/types.js';
import { formatMmSs, type ChunkWithTime } from './timestamp-utils.js';

export interface TranslatedChunk extends ChunkWithTime {
  originalText: string;
  isUntranslated?: boolean;
}

export interface TranslationLine {
  lineIndex: number;
  text: string;
  start?: string;
  end?: string;
}

export interface SmallTranslationUnit {
  unitIndex: number;
  startSec: number;
  endSec: number;
  timestamps: string;
  lines: TranslationLine[];
  sourceText: string;
  translatedText?: string;
  translatedLines?: TranslationLine[];
  status: 'translated' | 'untranslated';
  ratio: number;
  retried: boolean;
  rejectionReason?: string;
  sourceWordCount: number;
  translatedWordCount: number;
}

/**
 * Normalizes Devanagari digits (०-९) to Latin digits (0-9).
 */
export function normalizeDevanagariDigits(text: string): string {
  const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  let res = text;
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(devanagariDigits[i], String(i));
  }
  return res;
}

/**
 * Parses timestamp string "HH:MM:SS.mmm" or "MM:SS" into seconds.
 */
function parseTimestampToSec(ts: string | number): number {
  if (typeof ts === 'number') return ts;
  if (!ts) return 0;
  const parts = ts.split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parseFloat(ts) || 0;
}

/**
 * Groups caption lines into small units (about 8 to 12 caption lines or ~60 words).
 */
export function buildSmallTranslationUnits(
  segments: Array<{ start: string | number; end: string | number; text: string }>,
  targetLines: number = 10,
  targetWords: number = 60
): SmallTranslationUnit[] {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const units: SmallTranslationUnit[] = [];
  let curLines: TranslationLine[] = [];
  let curWordCount = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const text = (seg.text || '').trim();
    if (!text) continue;

    const words = text.split(/\s+/).filter(Boolean).length;
    curLines.push({
      lineIndex: curLines.length,
      text,
      start: String(seg.start),
      end: String(seg.end),
    });
    curWordCount += words;

    const shouldFlush = curLines.length >= 12 || (curLines.length >= 8 && curWordCount >= targetWords) || (curWordCount >= 75);
    if (shouldFlush) {
      const startSec = parseTimestampToSec(curLines[0].start || 0);
      const endSec = parseTimestampToSec(curLines[curLines.length - 1].end || 0);
      const sourceText = curLines.map(l => l.text).join(' ');

      units.push({
        unitIndex: units.length + 1,
        startSec: Number(startSec.toFixed(1)),
        endSec: Number(endSec.toFixed(1)),
        timestamps: `${formatMmSs(startSec)} - ${formatMmSs(endSec)}`,
        lines: curLines,
        sourceText,
        status: 'untranslated',
        ratio: 0,
        retried: false,
        sourceWordCount: sourceText.split(/\s+/).filter(Boolean).length,
        translatedWordCount: 0,
      });

      curLines = [];
      curWordCount = 0;
    }
  }

  if (curLines.length > 0) {
    const startSec = parseTimestampToSec(curLines[0].start || 0);
    const endSec = parseTimestampToSec(curLines[curLines.length - 1].end || 0);
    const sourceText = curLines.map(l => l.text).join(' ');

    units.push({
      unitIndex: units.length + 1,
      startSec: Number(startSec.toFixed(1)),
      endSec: Number(endSec.toFixed(1)),
      timestamps: `${formatMmSs(startSec)} - ${formatMmSs(endSec)}`,
      lines: curLines,
      sourceText,
      status: 'untranslated',
      ratio: 0,
      retried: false,
      sourceWordCount: sourceText.split(/\s+/).filter(Boolean).length,
      translatedWordCount: 0,
    });
  }

  return units;
}

/**
 * Validates a candidate translation against source text:
 * 1. Length ratio must be between 0.6 and 1.6
 * 2. Numbers and proper names in translation must appear in source
 */
export function validateTranslationResult(
  sourceText: string,
  translatedText: string,
  whisperWindowText?: string
): { valid: boolean; reason?: string; ratio: number; sourceWords: number; translatedWords: number } {
  const normSource = normalizeDevanagariDigits(sourceText).toLowerCase();
  const sourceWords = normSource.split(/\s+/).filter(Boolean).length;
  const translatedWords = translatedText.split(/\s+/).filter(Boolean).length;

  const ratio = sourceWords > 0 ? Number((translatedWords / sourceWords).toFixed(2)) : 1.0;

  if (ratio < 0.6) {
    return {
      valid: false,
      reason: `Length ratio ${ratio} is below 0.6 (source words: ${sourceWords}, translated words: ${translatedWords})`,
      ratio,
      sourceWords,
      translatedWords,
    };
  }
  if (ratio > 1.6) {
    return {
      valid: false,
      reason: `Length ratio ${ratio} is above 1.6 (source words: ${sourceWords}, translated words: ${translatedWords})`,
      ratio,
      sourceWords,
      translatedWords,
    };
  }

  // Number check: any digit sequence in translation must be present in source or Whisper window
  const transNumbers = translatedText.match(/\b\d+\b/g) || [];
  for (const num of transNumbers) {
    const inSource = normSource.includes(num);
    const inWhisper = whisperWindowText ? whisperWindowText.includes(num) : false;
    if (!inSource && !inWhisper) {
      return {
        valid: false,
        reason: `Number "${num}" in translation does not exist in source text or Whisper window`,
        ratio,
        sourceWords,
        translatedWords,
      };
    }
  }

  // Proper noun / name check: any non-sentence-initial capitalized word must appear in source or Whisper window
  const words = translatedText.split(/\s+/);
  const commonStop = new Set([
    'the', 'this', 'these', 'that', 'with', 'from', 'for', 'and', 'not', 'what', 'why', 'how', 'when',
    'one', 'two', 'three', 'four', 'first', 'second', 'then', 'now', 'today', 'also', 'because', 'their',
    'here', 'there', 'some', 'many', 'all', 'any', 'each', 'both', 'our', 'your', 'his', 'her', 'its'
  ]);

  for (let i = 0; i < words.length; i++) {
    const rawWord = words[i];
    const cleanWord = rawWord.replace(/^[^\w]+|[^\w]+$/g, '');
    if (!cleanWord || cleanWord.length <= 1) continue;
    const isSentenceInitial = (i === 0) || (i > 0 && /[.?!:]$/.test(words[i - 1]));
    if (isSentenceInitial) continue;

    if (/^[A-Z][a-zA-Z0-9-]*$/.test(cleanWord) && !commonStop.has(cleanWord.toLowerCase())) {
      const lowerWord = cleanWord.toLowerCase();
      const inSource = normSource.includes(lowerWord);
      const inWhisper = whisperWindowText ? whisperWindowText.toLowerCase().includes(lowerWord) : false;
      if (!inSource && !inWhisper) {
        return {
          valid: false,
          reason: `Proper name/entity "${cleanWord}" in translation does not exist in source text or Whisper window`,
          ratio,
          sourceWords,
          translatedWords,
        };
      }
    }
  }

  return { valid: true, ratio, sourceWords, translatedWords };
}

/**
 * Translates small units (8-12 caption lines or ~60 words), temperature 0,
 * with instruction "translate faithfully, do not add, explain or summarize, keep names and numbers".
 * Returns JSON per line index.
 * Rejects if ratio is out of range (0.6-1.6) or a number/name is missing, retries once,
 * otherwise marks as "untranslated" with a visible flag.
 */
export async function translateSmallUnits(
  units: SmallTranslationUnit[],
  client: UnifiedModelClient,
  sourceLanguage: string = 'hi'
): Promise<SmallTranslationUnit[]> {
  const normLang = (sourceLanguage || 'auto').toLowerCase().trim();
  if (normLang === 'en' || normLang === 'english') {
    return units.map(u => ({
      ...u,
      translatedText: u.sourceText,
      status: 'translated',
      ratio: 1.0,
      translatedWordCount: u.sourceWordCount,
    }));
  }

  const results: SmallTranslationUnit[] = [];

  for (const unit of units) {
    console.log(`[Unit ${unit.unitIndex}/${units.length}] Translating ${unit.timestamps} (${unit.sourceWordCount} words)...`);
    const inputLines = unit.lines.map(l => ({ lineIndex: l.lineIndex, text: l.text }));

    const systemPrompt = `You are a faithful line-by-line translator.
Instruction: translate faithfully, do not add, explain or summarize, keep names and numbers.
Return ONLY a valid JSON object in this format:
{
  "translations": [
    { "lineIndex": 0, "text": "English translation for line 0" }
  ]
}`;

    const makeMessages = (retryNotice?: string): ChatMessage[] => {
      const msgs: ChatMessage[] = [{ role: 'system', content: systemPrompt }];
      if (retryNotice) {
        msgs.push({
          role: 'user',
          content: `${retryNotice}\n\nTranslate these lines faithfully:\n${JSON.stringify({ lines: inputLines }, null, 2)}`,
        });
      } else {
        msgs.push({
          role: 'user',
          content: JSON.stringify({ lines: inputLines }, null, 2),
        });
      }
      return msgs;
    };

    let attempt = 0;
    let success = false;
    let finalTranslatedText = '';
    let finalTranslatedLines: TranslationLine[] = [];
    let finalRatio = 0;
    let lastReason: string | undefined = undefined;

    while (attempt < 2 && !success) {
      attempt++;
      try {
        const retryFeedback = attempt === 2 ? `PREVIOUS ATTEMPT REJECTED: ${lastReason}. Do not add commentary or summarize. Match source line length and preserve exact numbers.` : undefined;
        const resp = await client.complete(makeMessages(retryFeedback), {
          temperature: 0.0,
          jsonMode: true,
          maxTokens: 1000,
        });

        let parsed: any;
        try {
          parsed = JSON.parse(resp.content);
        } catch {
          const match = resp.content.match(/\{[\s\S]*\}/);
          if (match) parsed = JSON.parse(match[0]);
        }

        if (parsed && Array.isArray(parsed.translations)) {
          const transLines: TranslationLine[] = parsed.translations.map((t: any) => ({
            lineIndex: Number(t.lineIndex),
            text: String(t.text || '').trim(),
          }));

          const combinedText = transLines.map(t => t.text).join(' ').trim();
          const validation = validateTranslationResult(unit.sourceText, combinedText);

          if (validation.valid) {
            success = true;
            finalTranslatedText = combinedText;
            finalTranslatedLines = transLines;
            finalRatio = validation.ratio;
            break;
          } else {
            lastReason = validation.reason;
            finalRatio = validation.ratio;
          }
        } else {
          lastReason = 'Invalid response schema: missing translations array';
        }
      } catch (err: any) {
        lastReason = `LLM call error: ${err.message}`;
      }
    }

    if (success) {
      results.push({
        ...unit,
        translatedText: finalTranslatedText,
        translatedLines: finalTranslatedLines,
        status: 'translated',
        ratio: finalRatio,
        retried: attempt > 1,
        translatedWordCount: finalTranslatedText.split(/\s+/).filter(Boolean).length,
      });
    } else {
      // Mark as untranslated with visible flag
      const flaggedText = `[UNTRANSLATED] ${unit.sourceText}`;
      results.push({
        ...unit,
        translatedText: flaggedText,
        status: 'untranslated',
        ratio: finalRatio,
        retried: true,
        rejectionReason: lastReason,
        translatedWordCount: unit.sourceWordCount,
      });
    }
  }

  return results;
}

/**
 * Translates each transcript chunk into English using small unit faithful translation.
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

    // Split chunk text into small sentences / lines
    const sentences = chunk.text
      .split(/(?<=[।?!.\n])\s+/)
      .map((s, idx) => ({ start: idx, end: idx + 1, text: s.trim() }))
      .filter(s => s.text.length > 0);

    const units = buildSmallTranslationUnits(sentences, 4, 60);
    const translatedUnits = await translateSmallUnits(units, client, normLang);

    const isAnyUntranslated = translatedUnits.some(u => u.status === 'untranslated');
    const fullEnglish = translatedUnits.map(u => u.translatedText).join(' ').trim();

    translated.push({
      ...chunk,
      originalText: chunk.text,
      text: fullEnglish.length > 0 ? fullEnglish : chunk.text,
      isUntranslated: isAnyUntranslated,
    });
  }

  return translated;
}
