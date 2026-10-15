import { ValidationError } from './transcript.schema.js';

export interface OutlinePillar {
  name: string;
  description: string;
}

export interface PresentationOutline {
  title: string;
  subtitle: string;
  pillars: OutlinePillar[];
  keyTopics: string[];
  targetSlideCount: number;
  rawSynthesis: string;
}

/**
 * Validates and normalizes synthesis stage outline data.
 * Throws ValidationError if required fields are missing or invalid.
 */
export function validatePresentationOutline(input: unknown): PresentationOutline {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Outline', 'Outline input must be an object');
  }

  const candidate = input as Partial<PresentationOutline>;

  if (!candidate.title || typeof candidate.title !== 'string' || candidate.title.trim().length === 0) {
    throw new ValidationError('Outline', 'Outline must include a non-empty string "title"');
  }

  const title = candidate.title.trim();

  const subtitle = typeof candidate.subtitle === 'string' && candidate.subtitle.trim().length > 0
    ? candidate.subtitle.trim()
    : 'Strategic Overview and Key Takeaways';

  if (!Array.isArray(candidate.pillars) || candidate.pillars.length === 0) {
    throw new ValidationError('Outline', 'Outline must include a non-empty array of "pillars"');
  }

  const pillars: OutlinePillar[] = candidate.pillars
    .filter((p) => p && typeof p === 'object' && typeof p.name === 'string' && typeof p.description === 'string')
    .map((p) => ({ name: p.name.trim(), description: p.description.trim() }));

  if (pillars.length === 0) {
    throw new ValidationError('Outline', 'Outline pillars must have valid "name" and "description" strings');
  }

  let keyTopics: string[] = [];
  if (Array.isArray(candidate.keyTopics)) {
    keyTopics = candidate.keyTopics.filter((t) => typeof t === 'string' && t.trim().length > 0);
  }
  if (keyTopics.length === 0) {
    keyTopics = ['Executive Overview', 'Key Drivers', 'Deep Dive', 'Action Plan'];
  }

  const targetSlideCount = typeof candidate.targetSlideCount === 'number' && candidate.targetSlideCount >= 4
    ? candidate.targetSlideCount
    : 7;

  const rawSynthesis = typeof candidate.rawSynthesis === 'string' ? candidate.rawSynthesis : '';

  return {
    title,
    subtitle,
    pillars,
    keyTopics,
    targetSlideCount,
    rawSynthesis,
  };
}
