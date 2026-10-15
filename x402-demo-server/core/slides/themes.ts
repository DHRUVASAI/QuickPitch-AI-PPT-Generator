import { type PresentationTheme, THEMES } from '../schemas/slide.schema.js';

export function selectTheme(requestedTheme?: string, contextText: string = ''): PresentationTheme {
  if (requestedTheme && THEMES[requestedTheme]) {
    return THEMES[requestedTheme];
  }

  const themeKeys = Object.keys(THEMES);
  const lower = contextText.toLowerCase();

  if (lower.includes('tech') || lower.includes('cyber') || lower.includes('code') || lower.includes('software')) {
    return THEMES['cyber-blue'];
  } else if (lower.includes('finance') || lower.includes('growth') || lower.includes('market') || lower.includes('financial')) {
    return THEMES['emerald-growth'];
  } else if (lower.includes('design') || /\b(art|arts)\b/i.test(lower) || lower.includes('creative') || lower.includes('story')) {
    return THEMES['midnight-purple'];
  } else if (lower.includes('luxury') || lower.includes('brand') || lower.includes('premium') || lower.includes('speech')) {
    return THEMES['crimson-luxe'];
  } else if (lower.includes('matrix') || lower.includes('ai') || lower.includes('future') || lower.includes('innovation')) {
    return THEMES['neon-matrix'];
  } else if (lower.includes('business') || lower.includes('corporate') || lower.includes('report')) {
    return THEMES['monochrome-light'];
  }

  let hash = 0;
  for (let i = 0; i < contextText.length; i++) {
    hash = (hash << 5) - hash + contextText.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % themeKeys.length;
  return THEMES[themeKeys[index]];
}
