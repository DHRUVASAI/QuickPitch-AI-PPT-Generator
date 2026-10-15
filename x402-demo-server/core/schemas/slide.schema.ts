import { ValidationError } from './transcript.schema.js';

export type SlideLayoutType =
  | 'split_cards'
  | 'three_columns'
  | 'four_columns'
  | 'hero_quote'
  | 'diagram_flow'
  | 'data_table'
  | 'roadmap_timeline'
  | 'stats_spotlight'
  | 'comparison_split'
  | 'quadrant_grid'
  | 'outro_slide';

export interface SlideCard {
  card_title: string;
  icon?: string;
  points: string[];
}

export interface SlideItem {
  title: string;
  subtitle?: string;
  category?: string;
  layout_type?: SlideLayoutType;
  quote?: string;
  quote_author?: string;
  table_headers?: string[];
  table_rows?: string[][];
  stats?: { value: string; label: string; note?: string }[];
  roadmap_steps?: { phase: string; title: string; description: string }[];
  cards: SlideCard[];
}

export interface PresentationTheme {
  name: string;
  bg: string;
  cardBg: string;
  accent: string;
  accentSecondary: string;
  textPrimary: string;
  textMuted: string;
  cardBorder: string;
  fontTitle: string;
  fontBody: string;
}

export const THEMES: Record<string, PresentationTheme> = {
  'monochrome-dark': {
    name: 'Monochrome Dark',
    bg: '000000',
    cardBg: '111111',
    accent: 'FFFFFF',
    accentSecondary: '888888',
    textPrimary: 'FFFFFF',
    textMuted: 'AAAAAA',
    cardBorder: '222222',
    fontTitle: 'Trebuchet MS',
    fontBody: 'Calibri',
  },
  'monochrome-light': {
    name: 'Clean White Light',
    bg: 'FFFFFF',
    cardBg: 'F4F4F5',
    accent: '000000',
    accentSecondary: '444444',
    textPrimary: '000000',
    textMuted: '555555',
    cardBorder: 'E4E4E7',
    fontTitle: 'Trebuchet MS',
    fontBody: 'Calibri',
  },
  'midnight-purple': {
    name: 'Midnight Purple',
    bg: '1E1B4B',
    cardBg: '2E1065',
    accent: 'A78BFA',
    accentSecondary: 'EC4899',
    textPrimary: 'FAF5FF',
    textMuted: 'C084FC',
    cardBorder: '4C1D95',
    fontTitle: 'Georgia',
    fontBody: 'Calibri',
  },
  'emerald-growth': {
    name: 'Emerald Growth',
    bg: '064E3B',
    cardBg: '022C22',
    accent: '34D399',
    accentSecondary: 'F59E0B',
    textPrimary: 'ECFDF5',
    textMuted: '6EE7B7',
    cardBorder: '047857',
    fontTitle: 'Trebuchet MS',
    fontBody: 'Calibri',
  },
  'warm-sunset': {
    name: 'Warm Sunset',
    bg: '18181B',
    cardBg: '27272A',
    accent: 'F59E0B',
    accentSecondary: 'F43F5E',
    textPrimary: 'FAFAFA',
    textMuted: 'A1A1AA',
    cardBorder: '3F3F46',
    fontTitle: 'Georgia',
    fontBody: 'Calibri',
  },
  'cyber-blue': {
    name: 'Cyber Blue',
    bg: '0F172A',
    cardBg: '1E293B',
    accent: '38BDF8',
    accentSecondary: '818CF8',
    textPrimary: 'F8FAFC',
    textMuted: '94A3B8',
    cardBorder: '334155',
    fontTitle: 'Trebuchet MS',
    fontBody: 'Calibri',
  },
  'crimson-luxe': {
    name: 'Crimson Luxe',
    bg: '4C0519',
    cardBg: '881337',
    accent: 'FB7185',
    accentSecondary: 'F43F5E',
    textPrimary: 'FFF1F2',
    textMuted: 'FDA4AF',
    cardBorder: '9F1239',
    fontTitle: 'Georgia',
    fontBody: 'Calibri',
  },
  'neon-matrix': {
    name: 'Neon Matrix',
    bg: '000000',
    cardBg: '09090B',
    accent: '22C55E',
    accentSecondary: '06B6D4',
    textPrimary: 'FFFFFF',
    textMuted: '4ADE80',
    cardBorder: '15803D',
    fontTitle: 'Trebuchet MS',
    fontBody: 'Calibri',
  },
};

export interface SlideDeck {
  theme: string;
  detailLevel: 'concise' | 'balanced' | 'detailed';
  slides: SlideItem[];
}

/**
 * Validates and normalizes slide stage data
 */
export function validateSlideDeck(input: unknown): SlideDeck {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Slide', 'SlideDeck input must be an object');
  }

  const candidate = input as Partial<SlideDeck>;
  const theme = typeof candidate.theme === 'string' && THEMES[candidate.theme]
    ? candidate.theme
    : 'cyber-blue';

  const detailLevel = candidate.detailLevel && ['concise', 'balanced', 'detailed'].includes(candidate.detailLevel)
    ? candidate.detailLevel
    : 'balanced';

  if (!Array.isArray(candidate.slides) || candidate.slides.length === 0) {
    throw new ValidationError('Slide', 'SlideDeck must contain at least 1 slide');
  }

  const validatedSlides: SlideItem[] = candidate.slides.map((s, idx) => {
    if (!s || typeof s !== 'object') {
      throw new ValidationError('Slide', `Slide at index ${idx} is not an object`);
    }

    const title = typeof s.title === 'string' && s.title.trim().length > 0
      ? s.title.trim()
      : `Slide ${idx + 1}`;

    const subtitle = typeof s.subtitle === 'string' ? s.subtitle.trim() : undefined;
    const category = typeof s.category === 'string' ? s.category.trim() : 'STRATEGIC INSIGHT';

    let cards: SlideCard[] = [];
    if (Array.isArray(s.cards)) {
      cards = s.cards
        .filter(c => c && typeof c === 'object')
        .map((c, cIdx) => ({
          card_title: typeof c.card_title === 'string' ? c.card_title.trim() : `Section ${cIdx + 1}`,
          icon: typeof c.icon === 'string' ? c.icon : undefined,
          points: Array.isArray(c.points) ? c.points.map(p => String(p).trim()).filter(Boolean) : [],
        }));
    }

    if (cards.length === 0) {
      cards = [
        { card_title: 'Core Observation', points: ['Direct finding extracted from source material'] },
        { card_title: 'Execution Impact', points: ['Recommended takeaway and action'] },
      ];
    }

    return {
      title,
      subtitle,
      category,
      layout_type: s.layout_type,
      quote: typeof s.quote === 'string' ? s.quote.trim() : undefined,
      quote_author: typeof s.quote_author === 'string' ? s.quote_author.trim() : undefined,
      table_headers: Array.isArray(s.table_headers) ? s.table_headers : undefined,
      table_rows: Array.isArray(s.table_rows) ? s.table_rows : undefined,
      stats: Array.isArray(s.stats) ? s.stats : undefined,
      roadmap_steps: Array.isArray(s.roadmap_steps) ? s.roadmap_steps : undefined,
      cards,
    };
  });

  return {
    theme,
    detailLevel,
    slides: validatedSlides,
  };
}
