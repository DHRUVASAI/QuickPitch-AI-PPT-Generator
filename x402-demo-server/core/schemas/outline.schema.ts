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
 * Validates and normalizes synthesis stage outline data
 */
export function validatePresentationOutline(input: unknown): PresentationOutline {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Outline', 'Outline input must be an object');
  }

  const candidate = input as Partial<PresentationOutline>;

  const title = typeof candidate.title === 'string' && candidate.title.trim().length > 0
    ? candidate.title.trim()
    : 'Executive Presentation';

  const subtitle = typeof candidate.subtitle === 'string' && candidate.subtitle.trim().length > 0
    ? candidate.subtitle.trim()
    : 'Strategic Overview and Key Takeaways';

  let pillars: OutlinePillar[] = [];
  if (Array.isArray(candidate.pillars)) {
    pillars = candidate.pillars.filter(p => p && typeof p.name === 'string' && typeof p.description === 'string');
  }
  if (pillars.length === 0) {
    pillars = [
      { name: 'Core Context', description: 'Background and framing of the domain' },
      { name: 'Strategic Challenges', description: 'Core friction points and problems identified' },
      { name: 'Core Insights', description: 'Tactical interventions, ideas, and frameworks' },
      { name: 'Impact & Takeaways', description: 'Long term execution trajectory and vision' },
    ];
  }

  let keyTopics: string[] = [];
  if (Array.isArray(candidate.keyTopics)) {
    keyTopics = candidate.keyTopics.filter(t => typeof t === 'string' && t.trim().length > 0);
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
