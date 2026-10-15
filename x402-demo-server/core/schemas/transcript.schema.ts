export interface TranscriptSegment {
  text: string;
  start?: number;
  duration?: number;
}

export interface TranscriptMetadata {
  url?: string;
  author?: string;
  description?: string;
  durationSeconds?: number;
  language?: string;
  detectedLanguage?: string;
  languageConfidence?: number;
  lowLanguageConfidence?: boolean;
  fetchedAt?: number;
  partial?: boolean;
}

export interface TranscriptData {
  sourceType: 'youtube' | 'audio' | 'text';
  title: string;
  rawText: string;
  sanitizedText: string;
  charCount: number;
  segments?: TranscriptSegment[];
  metadata?: TranscriptMetadata;
}

export class ValidationError extends Error {
  constructor(public stage: string, message: string, public details?: any) {
    super(`[${stage} ValidationError] ${message}`);
    this.name = 'ValidationError';
  }
}

/**
 * Validates and normalizes transcript stage output
 */
export function validateTranscriptData(input: unknown): TranscriptData {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Transcript', 'Input must be an object');
  }

  const candidate = input as Partial<TranscriptData>;

  if (!candidate.sourceType || !['youtube', 'audio', 'text'].includes(candidate.sourceType)) {
    throw new ValidationError('Transcript', 'Invalid or missing sourceType (must be "youtube", "audio", or "text")');
  }

  const title = typeof candidate.title === 'string' && candidate.title.trim().length > 0
    ? candidate.title.trim()
    : 'Presentation Subject';

  const rawText = typeof candidate.rawText === 'string' ? candidate.rawText : '';
  const sanitizedText = typeof candidate.sanitizedText === 'string' ? candidate.sanitizedText.trim() : rawText.trim();

  if (sanitizedText.length === 0) {
    throw new ValidationError('Transcript', 'Transcript text cannot be empty');
  }

  return {
    sourceType: candidate.sourceType,
    title,
    rawText,
    sanitizedText,
    charCount: sanitizedText.length,
    segments: Array.isArray(candidate.segments) ? candidate.segments : undefined,
    metadata: typeof candidate.metadata === 'object' && candidate.metadata !== null ? candidate.metadata : undefined,
  };
}
