import fs from 'node:fs';
import path from 'node:path';

export interface VerifyQuoteResult {
  verified: boolean;
  filePath: string;
  lineIndex: number; // 1-indexed line number
  charOffset: number;
  matchedLine: string;
  quote: string;
}

/**
 * Checks whether quote is an exact substring in filePath.
 * If verified, returns the exact line index (1-based) and line text.
 * If not found, returns verified: false.
 */
export function verifyQuote(filePath: string, quote: string): VerifyQuoteResult {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    return {
      verified: false,
      filePath: resolvedPath,
      lineIndex: -1,
      charOffset: -1,
      matchedLine: '',
      quote,
    };
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const normalizedQuote = quote.replace(/\r\n/g, '\n');

  const charOffset = normalizedContent.indexOf(normalizedQuote);
  if (charOffset === -1) {
    // Try trimmed quote
    const trimmedQuote = normalizedQuote.trim();
    const trimmedOffset = normalizedContent.indexOf(trimmedQuote);
    if (trimmedOffset === -1) {
      return {
        verified: false,
        filePath: resolvedPath,
        lineIndex: -1,
        charOffset: -1,
        matchedLine: '',
        quote,
      };
    }
    const linesUpToMatch = normalizedContent.slice(0, trimmedOffset).split('\n');
    const lineIndex = linesUpToMatch.length;
    const lines = normalizedContent.split('\n');
    return {
      verified: true,
      filePath: resolvedPath,
      lineIndex,
      charOffset: trimmedOffset,
      matchedLine: lines[lineIndex - 1] || '',
      quote: trimmedQuote,
    };
  }

  const linesUpToMatch = normalizedContent.slice(0, charOffset).split('\n');
  const lineIndex = linesUpToMatch.length;
  const lines = normalizedContent.split('\n');

  return {
    verified: true,
    filePath: resolvedPath,
    lineIndex,
    charOffset,
    matchedLine: lines[lineIndex - 1] || '',
    quote: normalizedQuote,
  };
}

/**
 * Formats a verified quote reference for raw report printing.
 */
export function formatVerifiedQuote(result: VerifyQuoteResult): string {
  if (result.verified) {
    const relPath = path.relative(process.cwd(), result.filePath).replace(/\\/g, '/');
    return `[VERIFIED: ${relPath}:L${result.lineIndex}] "${result.quote}"`;
  }
  return `[UNVERIFIED: Quote not found in ${result.filePath}] "${result.quote}"`;
}
