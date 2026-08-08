import type { Context } from 'hono';
import { YoutubeTranscript } from 'youtube-transcript';
import OpenAI from 'openai';
import PptxGenJS from 'pptxgenjs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

interface SlideItem {
  title: string;
  subtitle?: string;
  category?: string;
  layout_type?: 'split_cards' | 'three_columns' | 'four_columns' | 'hero_quote' | 'diagram_flow' | 'data_table' | 'roadmap_timeline' | 'stats_spotlight' | 'comparison_split' | 'quadrant_grid' | 'outro_slide';
  quote?: string;
  quote_author?: string;
  table_headers?: string[];
  table_rows?: string[][];
  stats?: { value: string; label: string; note?: string }[];
  roadmap_steps?: { phase: string; title: string; description: string }[];
  cards: {
    card_title: string;
    icon?: string;
    points: string[];
  }[];
}

interface PresentationTheme {
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

const THEMES: Record<string, PresentationTheme> = {
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
    fontBody: 'Calibri'
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
    fontBody: 'Calibri'
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
    fontBody: 'Calibri'
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
    fontBody: 'Calibri'
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
    fontBody: 'Calibri'
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
    fontBody: 'Calibri'
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
    fontBody: 'Calibri'
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
    fontBody: 'Calibri'
  }
};

function selectTheme(requestedTheme?: string, contextText: string = ''): PresentationTheme {
  if (requestedTheme && THEMES[requestedTheme]) {
    return THEMES[requestedTheme];
  }
  
  const themeKeys = Object.keys(THEMES);
  const lower = contextText.toLowerCase();
  
  if (lower.includes('tech') || lower.includes('cyber') || lower.includes('code') || lower.includes('software')) {
    return THEMES['cyber-blue'];
  } else if (lower.includes('finance') || lower.includes('growth') || lower.includes('market')) {
    return THEMES['emerald-growth'];
  } else if (lower.includes('design') || lower.includes('art') || lower.includes('creative') || lower.includes('story')) {
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

async function fetchYouTubeMetadata(url: string): Promise<{ title: string; description: string }> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const html = await res.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/i) || html.match(/<meta property="og:title" content="(.*?)"/i);
    const descMatch = html.match(/<meta property="og:description" content="(.*?)"/i) || html.match(/<meta name="description" content="(.*?)"/i);
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : '';
    const description = descMatch ? descMatch[1].trim() : '';
    return { title, description };
  } catch (e) {
    return { title: '', description: '' };
  }
}

function cleanTextForPptx(text: string, maxLen: number = 200): string {
  if (!text) return '';
  return String(text)
    .replace(/<[^>]*>?/gm, ' ') // Strip HTML tags
    .replace(/https?:\/\/[^\s]+/gi, '') // Strip raw http:// and https:// URLs to prevent broken OpenXML auto-hyperlinks
    .replace(/www\.[^\s]+/gi, '') // Strip raw www. URLs
    .replace(/org\/licenses\/[^\s]+/gi, '') // Strip license URL fragments
    .replace(/verify at http[^\s]*/gi, '') // Strip verification URLs
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Strip non-printable ASCII control chars
    .replace(/&/g, 'and') // Replace raw ampersands to prevent XML entity parsing errors
    .replace(/</g, '')
    .replace(/>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function sanitizeTranscriptText(textContext: string): string {
  if (!textContext) return '';
  
  let cleaned = textContext
    .replace(/^WEBVTT$/gm, '')
    .replace(/^Kind:.*$/gm, '')
    .replace(/^Language:.*$/gm, '')
    .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/g, ' ') // SRT/VTT timestamps
    .replace(/\d{2}:\d{2}:\d{2}/g, ' ') // HH:MM:SS timestamps
    .replace(/\d{2}:\d{2}/g, ' ') // MM:SS timestamps
    .replace(/-\s*\[\s*\]/g, ' ') // Markdown empty checkbox - [ ]
    .replace(/-\s*\[\s*x\s*\]/gi, ' ') // Markdown checked checkbox - [x]
    .replace(/\[\s*\]/g, ' ')
    .replace(/^\s*\d+\s*$/gm, ' ') // Standalone line numbers (SRT index numbers)
    .replace(/\[Music\]|\[Applause\]|\[Laughter\]|\[Audio\]|\[Video\]|\[Silence\]/gi, ' ')
    .replace(/this program is brought to you by.*?(?:stanford|university|sponsor|channel|\.)/gi, ' ')
    .replace(/subscribe to (?:my|our) channel|like and subscribe|welcome back to/gi, ' ')
    .replace(/please visit us at.*?(?:edu|com|org|\s)/gi, ' ')
    .replace(/Source Video Title:|Video Description & Context:|Presentation request for/gi, ' ');

  // Strip lines that contain only digits, timestamps, or markdown artifacts (e.g. "43 44 10 810")
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      if (/^[0-9\s.,\-_:\[\]]+$/.test(line)) return false; // Line is only numbers/punctuation
      if (line.length < 5) return false;
      // Must contain at least 2 real alphabetic words
      const words = line.match(/[a-zA-Z]{2,}/g);
      if (!words || words.length < 2) return false;
      return true;
    })
    .join(' ');

  return cleanTextForPptx(cleaned, 25000);
}

function calculateSlideCount(textContext: string, detailLevel: string = 'balanced'): number {
  if (detailLevel === 'concise') {
    return 7; // 7 Slides Total (1 Cover + 6 Content Slides)
  }
  
  if (detailLevel === 'detailed') {
    const len = textContext.length;
    if (len > 10000) return 15; // 15 Slides for comprehensive deep-dive report
    if (len > 5000) return 13;  // 13 Slides for detailed breakdown
    return 11;                  // 11 Slides minimum for detailed mode
  }

  // Standard 'balanced' mode
  const len = textContext.length;
  if (len > 12000) return 12;
  if (len > 6000) return 10;
  if (len > 3000) return 8;
  return 7;
}

// Smart NLP sentence & keyword extractor for 100% unique presentations even if APIs are offline
function buildDynamicNLPDeck(textContext: string, topicHint?: string, targetTotalSlides: number = 7): SlideItem[] {
  const cleanText = sanitizeTranscriptText(textContext);
  const targetContentSlides = Math.max(6, targetTotalSlides - 1);
  
  // Split by punctuation OR 12-15 word chunks for unpunctuated transcripts
  let rawSentences = cleanText.split(/[.!?\n]/).map(s => s.trim()).filter(s => {
    if (s.length < 15) return false;
    if (/^[0-9\s.,\-_:\[\]]+$/.test(s)) return false;
    const words = s.match(/[a-zA-Z]{3,}/g);
    if (!words || words.length < 3) return false;
    const lower = s.toLowerCase();
    if (lower.includes('brought to you by') || lower.includes('visit us at') || lower.includes('music') || lower.includes('subscribe')) return false;
    if (isRefusalOrModeration(s)) return false;
    return true;
  });

  if (rawSentences.length <= 6) {
    const words = cleanText.split(/\s+/).filter(w => /[a-zA-Z]{2,}/.test(w));
    rawSentences = [];
    for (let i = 0; i < words.length; i += 14) {
      const chunk = words.slice(i, i + 14).join(' ').trim();
      if (chunk.length > 15 && !isRefusalOrModeration(chunk)) {
        rawSentences.push(chunk);
      }
    }
  }

  // Strictly truncate every sentence to max 110 chars and strip non-ASCII & numeric noise
  const sentences = rawSentences
    .map(s => s.replace(/[^\x00-\x7F]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(s => !/^[0-9\s.,\-_:\[\]]+$/.test(s))
    .map(s => s.length > 110 ? s.slice(0, 107) + '...' : s)
    .filter(s => s.length > 15);
  
  const title = (topicHint && topicHint !== 'YouTube Presentation' && topicHint !== 'Presentation Deck' ? topicHint : "Executive Insights Overview").slice(0, 55);

  // Divide sentences sequentially into non-overlapping buckets to eliminate repetition
  const bucketSize = Math.max(1, Math.floor(sentences.length / targetContentSlides));
  const getBucket = (idx: number) => {
    const start = idx * bucketSize;
    return sentences.slice(start, start + bucketSize).filter(Boolean);
  };

  // Find a meaningful quote from middle of speech
  const quoteCandidates = sentences.filter(s => {
    const l = s.toLowerCase();
    return s.length > 25 && s.length < 120 && !l.includes('welcome') && !l.includes('today') && !l.includes('stanford');
  });

  const bestQuote = (quoteCandidates[Math.floor(quoteCandidates.length / 2)] || quoteCandidates[0] || sentences[1] || "Authenticity and resilience are the core drivers of long-term success.").slice(0, 130);

  const categories = [
    'EXECUTIVE SUMMARY', 'CORE THEMES', 'STRATEGIC INSIGHTS', 'KEY HIGHLIGHTS',
    'PERSPECTIVE & VISION', 'KEY ARGUMENTS', 'INDUSTRY IMPACT', 'FUTURE OUTLOOK', 'CONCLUSION'
  ];

  const slides: SlideItem[] = [];

  for (let i = 0; i < targetContentSlides; i++) {
    const bucket = getBucket(i);
    const cleanBucket = bucket.filter(s => s.length > 10 && !isRefusalOrModeration(s));
    const cat = categories[i % categories.length];
    
    // Generate dynamic card titles from the actual sentence content
    const cardTitle1 = (cleanBucket[0] ? cleanBucket[0].split(/\s+/).slice(0, 3).join(' ') : 'Key Overview').slice(0, 40);
    const cardTitle2 = (cleanBucket[2] ? cleanBucket[2].split(/\s+/).slice(0, 3).join(' ') : 'Strategic Impact').slice(0, 40);

    if (i === 3) {
      // Slide 4: Hero Quote with 2 analytical context cards underneath
      slides.push({
        title: (cleanBucket[0] || title).slice(0, 50),
        subtitle: (cleanBucket[1] || 'Central philosophy and core perspective from the source content').slice(0, 75),
        category: cat,
        layout_type: 'hero_quote',
        quote: (bestQuote).slice(0, 130),
        cards: [
          { card_title: 'Analytical Context', points: cleanBucket.slice(0, 2).length > 0 ? cleanBucket.slice(0, 2) : ['Core driver shaping this perspective', 'Primary context behind the observation'] },
          { card_title: 'Strategic Takeaways', points: cleanBucket.slice(2, 4).length > 0 ? cleanBucket.slice(2, 4) : ['Key implication for stakeholders', 'Long-term influence and audience impact'] }
        ]
      });
    } else if (i % 2 === 1) {
      slides.push({
        title: (cleanBucket[0] || `Strategic Insight 0${i + 1}`).slice(0, 50),
        subtitle: (cleanBucket[1] || 'Core structural takeaways and analytical pillars').slice(0, 75),
        category: cat,
        layout_type: 'three_columns',
        cards: [
          { card_title: 'Core Context', points: [cleanBucket[0] || 'Primary background and setting'] },
          { card_title: 'Key Drivers', points: [cleanBucket[1] || 'Main thesis and core perspective'] },
          { card_title: 'Future Impact', points: [cleanBucket[2] || 'Broader significance and influence'] }
        ]
      });
    } else {
      slides.push({
        title: (cleanBucket[0] || `Key Focus Area 0${i + 1}`).slice(0, 50),
        subtitle: (cleanBucket[1] || 'Detailed breakdown of key concepts and insights').slice(0, 75),
        category: cat,
        layout_type: 'split_cards',
        cards: [
          { card_title: cardTitle1.length > 3 ? cardTitle1 : 'Key Takeaways', points: cleanBucket.slice(0, 3).length > 0 ? cleanBucket.slice(0, 3) : ['Primary observation from source content', 'Analysis of core claims'] },
          { card_title: cardTitle2.length > 3 ? cardTitle2 : 'Strategic Implications', points: cleanBucket.slice(3, 6).length > 0 ? cleanBucket.slice(3, 6) : ['Core themes and practical insights', 'Long-term audience resonance'] }
        ]
      });
    }
  }

  // Ensure first slide is Executive Overview
  if (slides[0]) {
    slides[0].title = title;
    slides[0].category = "EXECUTIVE SUMMARY";
  }

  return slides;
}

// Helper to check if string contains AI moderation refusal artifacts
function isRefusalOrModeration(str: string): boolean {
  if (!str) return false;
  const l = str.toLowerCase();
  return (
    l.includes('list of prohibited') ||
    l.includes('prohibited content') ||
    l.includes('cannot assist') ||
    l.includes('cannot fulfill') ||
    l.includes('as an ai language model') ||
    l.includes('terms of service') ||
    l.includes('safety guidelines') ||
    l.includes('against my guidelines') ||
    l.includes('i am unable to') ||
    l.includes('i cannot provide') ||
    l.includes('i must decline')
  );
}

// 🧠 Step 1: Internal Structured Knowledge Synthesizer
async function synthesizeTopicKnowledge(textContext: string, topicHint?: string): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const cleanContext = sanitizeTranscriptText(textContext).slice(0, 14000);

  const synthesisPrompt = `You are a master presentation research analyst and domain strategist.
Extract a comprehensive, factual, topic-grounded research outline from the following content:

SOURCE CONTENT (Topic / Title: "${topicHint || 'Source Media'}"):
"${cleanContext}"

══ MANDATORY EXTRACTION INSTRUCTIONS ══

1. 360° SOURCE OVERVIEW (For Cover & Executive Blueprint):
   - Executive Title & Subtitle: A compelling, comprehensive 12–18 word synthesis sentence explaining the entire subject.
   - 4-Pillar Executive Summary: (1) Subject Context, (2) Primary Challenges/Themes, (3) Core Interventions/Perspectives, (4) Ultimate Impact/Outcome.

2. STRICT FACTUAL GROUNDING & ANCHORING:
   - EVERY claim, metric, name, statement, or quote MUST be explicitly anchored in facts present in the source.
   - DO NOT invent artificial statistics, fake percentages, or unverified claims.
   - If exact quantitative metrics are not in the source, present qualitative findings as structured evidence directly derived from the text.

3. CONTENT CLASSIFICATION & TOPIC EXTRACTION:
   - If INTERVIEW / PODCAST / PERSONAL CONVERSATION:
     Extract 6-8 specific topics discussed (e.g. Personal Struggles, Creative Partnerships, Physical Transformation, Nepotism & Privilege, Vulnerability, Stepping Back).
   - If STARTUP PITCH / PRODUCT DEMO:
     Extract Project Name, Tagline, Problem, Solution, Architecture, Tech Stack, Monetization, Roadmap.
   - If LECTURE / SPEECH / ESSAY:
     Extract Core Thesis, 5 Pillars, Key Claims, Actionable Frameworks, Historical Impact.

4. NO GENERIC PLACEHOLDERS:
   - Never output generic headers like "Theme A", "Future Scope", "Practical Implications", "Core Analysis".
   - Use REAL NAMES, REAL CONCEPTS, REAL TOPICS, and REAL QUOTES from the source.

Return ONLY the structured English research outline as clear factual bullet points:`;

  if (groqKey) {
    const groqClient = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
    const modelsToTry = ['llama-3.3-70b-versatile', 'qwen/qwen3.6-27b', 'groq/compound', 'llama-3.1-8b-instant'];

    for (const modelName of modelsToTry) {
      try {
        console.log(`Synthesizing structured topic knowledge with Groq (${modelName})...`);
        const response = await groqClient.chat.completions.create({
          model: modelName,
          messages: [{ role: 'user', content: synthesisPrompt }],
          temperature: 0.3,
          max_tokens: 1800
        });
        const synthResult = response.choices[0].message.content || '';
        if (synthResult && !isRefusalOrModeration(synthResult)) {
          console.log(`Knowledge synthesis complete via ${modelName}!`);
          return synthResult;
        }
      } catch (e: any) {
        console.warn(`Groq synthesis error on ${modelName}:`, e.message);
      }
    }
  }

  if (geminiKey) {
    try {
      console.log('Synthesizing structured topic knowledge with Google Gemini 1.5 Flash...');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(synthesisPrompt);
      const synthResult = result.response.text();
      if (synthResult && !isRefusalOrModeration(synthResult)) {
        console.log('Knowledge synthesis complete via Gemini!');
        return synthResult;
      }
    } catch (eG: any) {
      console.warn('Gemini synthesis fallback error:', eG.message);
    }
  }

  if (openaiKey) {
    try {
      console.log('Synthesizing structured topic knowledge with OpenAI GPT-4o...');
      const openaiClient = new OpenAI({ apiKey: openaiKey });
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: synthesisPrompt }],
        temperature: 0.3,
      });
      const res = response.choices[0].message.content || '';
      if (res && !isRefusalOrModeration(res)) return res;
    } catch (e: any) {
      console.warn('OpenAI synthesis error:', e.message);
    }
  }

  if (geminiKey) {
    try {
      console.log('Synthesizing structured topic knowledge with Google Gemini...');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(synthesisPrompt);
      const res = result.response.text();
      if (res && !isRefusalOrModeration(res)) return res;
    } catch (e: any) {
      console.warn('Gemini synthesis error:', e.message);
    }
  }

  return cleanContext;
}

async function generateSlideStructure(textContext: string, topicHint?: string, targetTotalSlides: number = 7): Promise<SlideItem[]> {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const targetContentCount = Math.max(6, targetTotalSlides - 1);

  // 🧠 Step 1: Synthesize structured domain knowledge first
  const synthesizedAnalysis = await synthesizeTopicKnowledge(textContext, topicHint);

  const prompt = `You are a world-class presentation strategist, domain expert, and deck designer.
Analyze the structured research analysis below and produce an investor-grade ${targetContentCount}-slide presentation.

═══════ 1. SLIDE 1 & SLIDE 2 COMPREHENSIVE OVERVIEW MANDATE ═══════
- Slide 1 (Cover): Subtitle MUST be a comprehensive 12-18 word summary sentence synthesizing the ENTIRE source material.
- Slide 2 (Executive Overview Blueprint): MUST be structured as a 4-card 360° summary of the source:
  Card 1: "Source Subject & Context"
  Card 2: "Core Challenges / Central Themes"
  Card 3: "Key Perspectives / Interventions"
  Card 4: "Ultimate Impact & Lessons"

═══════ 2. STRICT FACTUAL GROUNDING & SOURCE ANCHORING ═══════
- Every metric, claim, quote, name, or statement MUST be anchored directly to facts in the source analysis.
- DO NOT invent unverified metrics, fake percentages, or artificial dates.
- If stats are not in the source, present qualitative findings as structured evidence.

═══════ 3. DYNAMIC CONTENT-AWARE CATEGORY TAGS (NO GENERIC "FUTURE SCOPE") ═══════
Choose category tags natural to the subject matter:
- For Interviews/Podcasts: "EXECUTIVE SUMMARY", "PERSONAL JOURNEY", "INDUSTRY DYNAMICS", "CREATIVE PARTNERSHIPS", "TRANSFORMATION", "VULNERABILITY & SCRUTINY", "EVOLUTION & VISION", "KEY LESSONS"
- For Startup Pitches: "EXECUTIVE SUMMARY", "PROBLEM STATEMENT", "SOLUTION OVERVIEW", "SYSTEM ARCHITECTURE", "TECH STACK", "MONETIZATION MODEL", "COMPETITIVE ADVANTAGE", "PRODUCT ROADMAP"
- For Speeches/Lectures: "EXECUTIVE SUMMARY", "HISTORICAL CONTEXT", "CORE THESIS", "EMPIRICAL EVIDENCE", "KEY FINDINGS", "STRATEGIC IMPLICATIONS", "LASTING LEGACY"
- NEVER output generic tags: "FUTURE SCOPE", "PRACTICAL IMPLICATIONS", "LONG-TERM VALUE", "CORE ANALYSIS", "RHETORICAL IMPACT".

═══════ 4. TOPIC FAITHFULNESS & NO PLACEHOLDERS ═══════
- Populate every slide with REAL, SPECIFIC FACTS, names, dates, metrics, quotes, or themes extracted from the source.
- NEVER output generic placeholder headers ("Theme A", "Core Insights", "Background", "Core Ideas", "Key Impact").

═══════ 5. SLIDE COUNT ═══════
Generate EXACTLY ${targetContentCount} slide objects in the JSON array. No more, no less.

═══════ 6. EXECUTIVE BULLET MANDATE ═══════
- Bullets MUST be punchy 3–8 word takeaways. Max 90 characters per bullet.
- NEVER copy full sentences from the transcript verbatim.

═══════ 7. LAYOUT SELECTION ═══════
Choose the best layout_type for each slide's semantic content:
- "split_cards"        → 2 equal wide columns (deep-dive analysis, two contrasting views)
- "three_columns"      → 3 equal pillar cards (features, benefits, principles)
- "four_columns"       → 4 small cards (tech stack components, executive blueprint cards)
- "hero_quote"         → Full-width quote box PLUS 2 analytical cards underneath!
- "diagram_flow"       → Numbered step boxes with arrows (architecture, workflow)
- "data_table"         → Styled comparison table (competitor analysis, feature matrix)
- "roadmap_timeline"   → Horizontal dot-connected timeline (roadmap, evolution milestones)
- "stats_spotlight"    → 3 giant number/stat callout cards (key metrics, impact)
- "comparison_split"   → Side-by-side contrast cards with central "VS" badge (Star Kids vs Outsiders, Traditional vs AI)
- "quadrant_grid"       → 2x2 grid of cards for multi-faceted topics (SWOT, 4 core pillars)
- "outro_slide"        → Thank-you / conclusion slide with tagline

═══════ TEXT CONSTRAINTS ═══════
- title: max 55 characters
- subtitle: max 90 characters
- category: max 50 characters
- card_title: max 45 characters
- bullet point: max 90 characters
- Include 3–5 bullet points per card.

═══════ JSON FORMAT ═══════
Return ONLY a raw JSON array. No markdown fences. No explanation text.
Use SINGLE QUOTES inside string values for any quotations.

JSON schema:
[
  {
    "title": "Slide Title",
    "subtitle": "Short subtitle here",
    "category": "CATEGORY TAG",
    "layout_type": "one of the layout types above",
    "quote": "Optional: direct quote for hero_quote slides",
    "quote_author": "Optional: speaker / source of quote",
    "stats": [],
    "roadmap_steps": [],
    "table_headers": [],
    "table_rows": [],
    "cards": [
      { "card_title": "Specific Card Header", "points": ["Bullet 1", "Bullet 2", "Bullet 3"] }
    ]
  }
]

Structured Research Analysis & Context:
${synthesizedAnalysis}`;
  let rawOutput = '';

  if (groqKey) {
    const groqClient = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
    const slideModelsToTry = ['llama-3.3-70b-versatile', 'qwen/qwen3.6-27b', 'groq/compound', 'llama-3.1-8b-instant'];

    for (const modelName of slideModelsToTry) {
      try {
        console.log(`Using Groq (${modelName}) for multi-layout slide generation...`);
        const response = await groqClient.chat.completions.create({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 4000
        });
        const res = response.choices[0].message.content || '';
        if (res && !isRefusalOrModeration(res)) {
          console.log(`✓ Slide generation completed via Groq (${modelName})!`);
          rawOutput = res;
          break;
        }
      } catch (err: any) {
        console.warn(`Groq slide generation error on ${modelName}:`, err.message);
      }
    }
  }

  if (!rawOutput && geminiKey) {
    try {
      console.log('Using Google Gemini 1.5 Flash for slide generation...');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const res = result.response.text();
      if (res && !isRefusalOrModeration(res)) {
        console.log('✓ Slide generation completed via Google Gemini!');
        rawOutput = res;
      }
    } catch (err: any) {
      console.warn('Gemini generation error:', err.message);
    }
  }

  if (!rawOutput && openaiKey) {
    try {
      console.log('Using OpenAI GPT-4o for slide generation...');
      const openaiClient = new OpenAI({ apiKey: openaiKey });
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });
      const res = response.choices[0].message.content || '';
      if (!isRefusalOrModeration(res)) rawOutput = res;
    } catch (err: any) {
      console.warn('OpenAI generation error:', err.message);
    }
  }

  // Strip reasoning/think tags emitted by Qwen/DeepSeek models (including unclosed <think> blocks)
  rawOutput = rawOutput.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
  rawOutput = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
  const jsonArrayMatch = rawOutput.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (jsonArrayMatch) {
    rawOutput = jsonArrayMatch[0];
  }

  let parsedSlides: SlideItem[] = [];

  // Clean literal control characters (newlines, tabs) inside JSON strings
  const sanitizeJsonLiteral = (str: string): string => {
    return str.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (m) => {
      return m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    });
  };

  try {
    const parsed = JSON.parse(sanitizeJsonLiteral(rawOutput));
    if (Array.isArray(parsed) && parsed.length >= 3) {
      console.log(`Successfully parsed AI JSON with ${parsed.length} slides!`);
      parsedSlides = parsed;
    }
  } catch (e: any) {
    console.warn('Failed to parse AI JSON:', e.message);
    try {
      // Repair single-quoted string values: 'value' -> "value"
      let repaired = rawOutput.replace(/(?<=:\s*)'([\s\S]*?)'(?=\s*[,}\]])/g, (_, inner) => {
        return '"' + inner.replace(/"/g, "'") + '"';
      });
      const parsed2 = JSON.parse(sanitizeJsonLiteral(repaired));
      if (Array.isArray(parsed2) && parsed2.length >= 3) {
        console.log(`Successfully parsed AI JSON with ${parsed2.length} slides after JSON repair!`);
        parsedSlides = parsed2;
      }
    } catch (e2: any) {
      console.warn('JSON repair fallback failed:', e2.message);
    }
  }

  if (parsedSlides.length === 0) {
    parsedSlides = buildDynamicNLPDeck(textContext, topicHint, targetTotalSlides);
  }

  // 🧹 Post-process & sanitize all slides:
  // 1. Remove any moderation/safety refusal text
  // 2. Convert any remaining Devanagari/Hindi transcript text to English
  // 3. Enrich hero_quote slides with analytical context cards
  return postProcessSlides(parsedSlides, topicHint);
}

// 🛡️ Post-processor & Sanitizer for Slide Content Quality
function postProcessSlides(slides: SlideItem[], topicHint?: string): SlideItem[] {
  const isRefusalOrModeration = (str: string): boolean => {
    if (!str) return false;
    const l = str.toLowerCase();
    return (
      l.includes('list of prohibited') ||
      l.includes('prohibited content') ||
      l.includes('cannot assist') ||
      l.includes('as an ai language model') ||
      l.includes('terms of service') ||
      l.includes('safety guidelines') ||
      l.includes('i am unable to') ||
      l.includes('i cannot provide')
    );
  };

  const hasDevanagari = (str: string): boolean => /[\u0900-\u097F]/.test(str);

  // Map generic AI category terms to natural, content-grounded terms
  const sanitizeCategoryTag = (cat: string, idx: number): string => {
    if (!cat) return `SECTION 0${idx + 1}`;
    const l = cat.toLowerCase();
    if (l.includes('future scope') || l.includes('future outlook')) return 'EVOLUTION & VISION';
    if (l.includes('practical implications')) return 'STRATEGIC IMPLICATIONS';
    if (l.includes('long-term value') || l.includes('long term value')) return 'VALUE & IMPACT';
    if (l.includes('core analysis') || l.includes('rhetorical impact')) return 'CORE INSIGHTS';
    return cleanTextForPptx(cat, 50).toUpperCase();
  };

  const isGarbageStr = (str: string): boolean => {
    if (!str) return true;
    if (isRefusalOrModeration(str)) return true;
    if (/^[0-9\s.,\-_:\[\]]+$/.test(str)) return true;
    if (str.includes('- [ ]') || str.includes('43 44')) return true;
    const alphaWords = str.match(/[a-zA-Z]{2,}/g);
    if (!alphaWords || alphaWords.length < 1) return true;
    return false;
  };

  // Clean or replace Devanagari text or garbage numeric artifacts with clean English executive text
  const cleanEnglishStr = (str: string, fallback: string, maxLen: number = 90): string => {
    if (!str || isGarbageStr(str)) return fallback;
    if (hasDevanagari(str)) {
      const stripped = str.replace(/[\u0900-\u097F]+/g, ' ').replace(/\s+/g, ' ').trim();
      return (stripped.length > 5 && !isGarbageStr(stripped) ? stripped : fallback).slice(0, maxLen);
    }
    const cleaned = cleanTextForPptx(str, maxLen);
    return isGarbageStr(cleaned) ? fallback : cleaned;
  };

  return slides
    .filter(slide => !isGarbageStr(slide.title) && !isRefusalOrModeration(slide.quote || ''))
    .map((slide, idx) => {
      const defaultTitle = topicHint || `Key Theme ${idx + 1}`;
      
      let cleanTitle = cleanEnglishStr(slide.title, defaultTitle, 55);
      // Replace generic hardcoded titles if present
      const lowerT = cleanTitle.toLowerCase();
      if (lowerT === 'core analysis' || lowerT === 'rhetorical impact' || lowerT === 'analysis & evidence' || lowerT === 'future scope' || lowerT === 'future outlook' || isGarbageStr(cleanTitle)) {
        cleanTitle = `${topicHint || 'Strategic Perspective'} 0${idx + 1}`;
      }

      const cleanSub = slide.subtitle ? cleanEnglishStr(slide.subtitle, 'Comprehensive breakdown and strategic takeaways', 90) : undefined;
      const cleanCat = sanitizeCategoryTag(slide.category || '', idx);

      const layoutType = slide.layout_type || 'split_cards';

      // 🌟 Fix Hero Quote Slide: Ensure it has 2 analytical cards below the quote box!
      let cards = (slide.cards || []).map(card => {
        let cardTitle = cleanEnglishStr(card.card_title || 'Key Insights', 'Key Focus Area', 45);
        const lowerC = cardTitle.toLowerCase();
        if (lowerC === 'core analysis' || lowerC === 'rhetorical impact' || lowerC === 'background' || lowerC === 'core ideas' || lowerC === 'key impact' || isGarbageStr(cardTitle)) {
          cardTitle = idx % 2 === 0 ? 'Analytical Context' : 'Strategic Takeaways';
        }
        const points = (card.points || [])
          .map(pt => cleanEnglishStr(typeof pt === 'string' ? pt : String(pt), 'Key analytical finding from source content', 90))
          .filter(pt => pt.length > 3 && !isGarbageStr(pt))
          .map(pt => {
            // Expand 1-3 word bullet points into full executive statements
            const words = pt.split(/\s+/);
            if (words.length < 4) {
              return `${pt}: Strategic mindset & execution principle`;
            }
            return pt;
          });

        return { card_title: cardTitle, points: points.length > 0 ? points : ['Key strategic takeaway from analysis', 'Core implication and audience impact'] };
      });

      if (layoutType === 'hero_quote' && cards.length === 0) {
        cards = [
          {
            card_title: 'Analytical Context',
            points: [
              cleanEnglishStr(slide.subtitle || 'Key background driving this perspective', 'Primary context and emotional driver', 90),
              'Reflection of core personal and professional evolution'
            ]
          },
          {
            card_title: 'Strategic Takeaways',
            points: [
              'Key lesson regarding public vulnerability and resilience',
              'Long-term cultural and audience impact'
            ]
          }
        ];
      }

      return {
        ...slide,
        title: cleanTitle,
        subtitle: cleanSub,
        category: cleanCat,
        layout_type: layoutType,
        quote: slide.quote ? cleanEnglishStr(slide.quote, slide.title, 150) : undefined,
        cards
      };
    });
}

export async function handleGeneratePpt(c: Context) {
  try {
    console.log('✓ QuickPitch Multi-Layout Engine executing...');
    
    const body = await c.req.json();
    const { source_type, url, text, theme: requestedTheme, detail_level } = body;

    let transcript = '';
    let topicHint = 'Presentation Deck';

    if (source_type === 'youtube' && url) {
      console.log(`Fetching YouTube metadata and transcript for ${url}...`);
      const meta = await fetchYouTubeMetadata(url);
      if (meta.title) {
        topicHint = meta.title;
      }

      const fetchWithTimeout = (promise: Promise<any>, timeoutMs: number = 12000) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), timeoutMs))
        ]);
      };

      try {
        const transcriptLines: any = await fetchWithTimeout(YoutubeTranscript.fetchTranscript(url, { lang: 'en' }), 12000);
        transcript = `Video Title: ${meta.title || 'YouTube Video'}\nVideo Description: ${meta.description}\nTranscript: ` + transcriptLines.map((t: any) => t.text).join(' ');
        console.log(`✓ YouTube transcript fetched successfully (${transcript.length} chars)`);
      } catch (err) {
        try {
          const transcriptLines: any = await fetchWithTimeout(YoutubeTranscript.fetchTranscript(url), 12000);
          transcript = `Video Title: ${meta.title || 'YouTube Video'}\nVideo Description: ${meta.description}\nTranscript: ` + transcriptLines.map((t: any) => t.text).join(' ');
          console.log(`✓ YouTube transcript auto-language fetched successfully (${transcript.length} chars)`);
        } catch (e2) {
          console.warn('YouTube transcript fallback triggered. Using enriched video metadata context...');
          topicHint = meta.title || 'YouTube Video Analysis';
          transcript = `Video Title: ${meta.title || 'YouTube Video'}\nVideo Description & Context: ${meta.description || 'Comprehensive overview of this video topic'}\nCore Subject: Executive analysis and strategic takeaways regarding ${meta.title || 'the featured subject'}.`;
        }
      }
    } else if ((source_type === 'text' || source_type === 'transcript') && text) {
      transcript = text;
      topicHint = text.slice(0, 50);
    } else if (source_type === 'audio' && text) {
      transcript = text;
      topicHint = 'Audio Recording Insights';
    } else {
      transcript = text || url || 'Executive Business Presentation';
    }

    if (!transcript || transcript.trim().length === 0) {
      transcript = "Executive Overview of Key Strategy and Milestones.";
    }

    const activeTheme = selectTheme(requestedTheme, transcript + (url || ''));
    const targetSlideCount = calculateSlideCount(transcript, detail_level);
    console.log(`Applying visual theme: ${activeTheme.name} (${activeTheme.bg}), Detail Level: ${detail_level || 'balanced'}, Target Slide Count: ${targetSlideCount}`);

    const slidesData = await generateSlideStructure(transcript, topicHint, targetSlideCount);
    
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9'; // 10.0 x 5.625 inches

    const BG   = activeTheme.bg;
    const CARD = activeTheme.cardBg;
    const ACC  = activeTheme.accent;
    const ACC2 = activeTheme.accentSecondary;
    const TXT  = activeTheme.textPrimary;
    const MUT  = activeTheme.textMuted;
    const BDR  = activeTheme.cardBorder;
    const FT   = activeTheme.fontTitle;
    const FB   = activeTheme.fontBody;

    const totalSlides = slidesData.length + 1; // +1 for cover

    // ── Helper: add a slide footer ────────────────────────────────────────────
    const addFooter = (slide: any, slideNum: number) => {
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0, y: 5.45, w: 10.0, h: 0.175,
        fill: { color: CARD }, line: { color: BDR, width: 0.5 }
      });
      slide.addText(`QuickPitch AI  ·  Slide ${slideNum} of ${totalSlides}  ·  x402 Protocol  ·  Algorand TestNet ($0.10 USDC)`, {
        x: 0.4, y: 5.46, w: 9.2, h: 0.16,
        fontSize: 8, color: MUT, align: 'left', fontFace: FB
      });
    };

    // ── Helper: add slide header (category + title + divider) ─────────────────
    const addSlideHeader = (slide: any, categoryStr: string, titleStr: string, subtitleStr?: string) => {
      // Top accent bar
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0, y: 0, w: 10.0, h: 0.06, fill: { color: ACC }
      });
      // Category label
      slide.addText(cleanTextForPptx(categoryStr.toUpperCase(), 60), {
        x: 0.5, y: 0.18, w: 9.0, h: 0.22,
        fontSize: 9, bold: true, color: ACC, fontFace: FT
      });
      // Title
      slide.addText(cleanTextForPptx(titleStr, 65), {
        x: 0.5, y: 0.4, w: 9.0, h: 0.7,
        fontSize: 24, bold: true, color: TXT, fontFace: FT
      });
      // Thin divider line under title
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0.5, y: 1.1, w: 9.0, h: 0.025, fill: { color: BDR }
      });
      if (subtitleStr) {
        slide.addText(cleanTextForPptx(subtitleStr, 110), {
          x: 0.5, y: 1.13, w: 9.0, h: 0.3,
          fontSize: 11.5, color: MUT, fontFace: FB
        });
      }
    };

    // ════════════════════════════════════════════════════════════════════
    // COVER SLIDE
    // ════════════════════════════════════════════════════════════════════
    const cover = pptx.addSlide();
    cover.background = { color: BG };

    // Full-width top accent bar (thick)
    cover.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 10.0, h: 0.22, fill: { color: ACC } });

    // Left accent strip
    cover.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0.22, w: 0.08, h: 5.0, fill: { color: ACC } });

    // Product badge pill (top-left)
    cover.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.5, y: 0.55, w: 3.0, h: 0.38,
      fill: { color: CARD }, line: { color: ACC, width: 1.5 }, rectRadius: 0.15
    });
    cover.addText('QUICKPITCH  ·  x402 HACKATHON', {
      x: 0.5, y: 0.55, w: 3.0, h: 0.38,
      fontSize: 9, bold: true, color: ACC, align: 'center', fontFace: FT
    });

    // Main title (large)
    const coverTitle = cleanTextForPptx(
      slidesData[0]?.title && slidesData[0].title.length > 4 && slidesData[0].title !== 'Executive Presentation'
        ? slidesData[0].title
        : topicHint,
      60
    );
    cover.addText(coverTitle, {
      x: 0.5, y: 1.15, w: 8.8, h: 1.6,
      fontSize: 40, bold: true, color: TXT, fontFace: FT, lineSpacingMultiple: 1.1
    });

    // Subtitle
    const coverSub = cleanTextForPptx(slidesData[0]?.subtitle || 'AI-Powered Presentation Generator', 100);
    cover.addText(coverSub, {
      x: 0.5, y: 2.85, w: 8.8, h: 0.55,
      fontSize: 16, color: MUT, fontFace: FB
    });

    // Divider
    cover.addShape(pptx.shapes.RECTANGLE, {
      x: 0.5, y: 3.5, w: 9.0, h: 0.025, fill: { color: BDR }
    });

    // Tech badges row
    const badges = ['Algorand', 'x402 Protocol', 'AWS Transcribe', 'Groq LLaMA', 'PptxGenJS'];
    badges.forEach((badge, i) => {
      const bw = 1.55;
      const bx = 0.5 + i * (bw + 0.15);
      cover.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: bx, y: 3.62, w: bw, h: 0.32,
        fill: { color: CARD }, line: { color: BDR, width: 1 }, rectRadius: 0.1
      });
      cover.addText(badge, {
        x: bx, y: 3.62, w: bw, h: 0.32,
        fontSize: 9, color: MUT, align: 'center', fontFace: FB
      });
    });

    // Algorand x402 Micropayment Banner (bottom left)
    cover.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.5, y: 4.2, w: 6.3, h: 0.5,
      fill: { color: CARD }, line: { color: ACC, width: 1.5 }, rectRadius: 0.1
    });
    cover.addText('⚡ Algorand TestNet  ·  x402 Protocol  ·  $0.10 USDC / Deck  ·  On-Chain Verified', {
      x: 0.7, y: 4.2, w: 5.9, h: 0.5,
      fontSize: 10, bold: true, color: ACC, align: 'left', fontFace: FT
    });

    // Team badge (bottom right)
    cover.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 7.0, y: 4.2, w: 2.5, h: 0.5,
      fill: { color: ACC }, line: { color: ACC, width: 1 }, rectRadius: 0.1
    });
    cover.addText('Team VUPO', {
      x: 7.0, y: 4.2, w: 2.5, h: 0.5,
      fontSize: 13, bold: true, color: BG, align: 'center', fontFace: FT
    });

    // Footer
    cover.addShape(pptx.shapes.RECTANGLE, {
      x: 0, y: 5.45, w: 10.0, h: 0.175,
      fill: { color: CARD }, line: { color: BDR, width: 0.5 }
    });
    cover.addText(`QuickPitch AI  ·  Slide 1 of ${totalSlides}  ·  x402 Protocol  ·  Algorand TestNet ($0.10 USDC)`, {
      x: 0.4, y: 5.46, w: 9.2, h: 0.16,
      fontSize: 8, color: MUT, align: 'left', fontFace: FB
    });

    // ════════════════════════════════════════════════════════════════════
    // CONTENT SLIDES
    // ════════════════════════════════════════════════════════════════════
    slidesData.forEach((slideItem, index) => {
      const slideNum = index + 2; // Cover is slide 1
      const slide = pptx.addSlide();
      slide.background = { color: BG };

      const layoutType = slideItem.layout_type || (index % 2 === 0 ? 'split_cards' : 'three_columns');
      const isOutro = layoutType === 'outro_slide';

      if (isOutro) {
        // ── OUTRO / THANK YOU SLIDE ──────────────────────────────────────────
        slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 10.0, h: 0.22, fill: { color: ACC } });
        slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0.22, w: 0.08, h: 5.0, fill: { color: ACC } });

        slide.addText(cleanTextForPptx(slideItem.title || 'Thank You', 40), {
          x: 1.0, y: 0.9, w: 8.0, h: 1.4,
          fontSize: 52, bold: true, color: TXT, fontFace: FT, align: 'center'
        });
        slide.addText(cleanTextForPptx(slideItem.subtitle || 'Questions?', 80), {
          x: 1.0, y: 2.4, w: 8.0, h: 0.55,
          fontSize: 18, color: MUT, fontFace: FB, align: 'center'
        });
        slide.addShape(pptx.shapes.RECTANGLE, {
          x: 2.5, y: 3.05, w: 5.0, h: 0.025, fill: { color: BDR }
        });
        slide.addText('QuickPitch  ·  AI + Blockchain + Cloud', {
          x: 1.0, y: 3.2, w: 8.0, h: 0.4,
          fontSize: 12, color: ACC, fontFace: FT, align: 'center', bold: true
        });
        slide.addText('Powered by x402  ·  Algorand  ·  AWS  ·  Groq LLaMA', {
          x: 1.0, y: 3.65, w: 8.0, h: 0.35,
          fontSize: 10, color: MUT, fontFace: FB, align: 'center'
        });
        addFooter(slide, slideNum);
        return;
      }

      addSlideHeader(slide, slideItem.category || `SECTION ${String(index + 1).padStart(2, '0')}`, slideItem.title || `Insight ${index + 1}`, slideItem.subtitle);
      addFooter(slide, slideNum);

      const contentY = slideItem.subtitle ? 1.45 : 1.20;
      const contentH = 5.20 - contentY; // Strict bound: max card Y is 5.20 (footer at 5.45)

      // ── HERO QUOTE ───────────────────────────────────────────────────────────
      if (layoutType === 'hero_quote' || slideItem.quote) {
        const hasCards = slideItem.cards && slideItem.cards.length > 0;
        const quoteBoxH = hasCards ? 1.6 : 3.6;

        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x: 0.5, y: contentY, w: 9.0, h: quoteBoxH,
          fill: { color: CARD }, line: { color: ACC, width: 2 }, rectRadius: 0.12
        });
        slide.addShape(pptx.shapes.RECTANGLE, {
          x: 0.5, y: contentY, w: 0.1, h: quoteBoxH, fill: { color: ACC }
        });
        slide.addText('"', {
          x: 0.9, y: contentY + 0.05, w: 0.8, h: quoteBoxH > 2.0 ? 0.85 : 0.45,
          fontSize: quoteBoxH > 2.0 ? 60 : 38, bold: true, color: ACC, fontFace: FT
        });
        const qText = cleanTextForPptx(slideItem.quote || slideItem.subtitle || slideItem.title, 180);
        slide.addText(qText, {
          x: 0.9, y: contentY + (hasCards ? 0.3 : 0.8), w: 8.1, h: hasCards ? 0.95 : 1.8,
          fontSize: hasCards ? 15 : 18, italic: true, color: TXT, fontFace: FT, align: 'center', lineSpacingMultiple: 1.2
        });
        if (slideItem.quote_author) {
          slide.addText(`— ${cleanTextForPptx(slideItem.quote_author, 60)}`, {
            x: 0.9, y: contentY + (hasCards ? 1.25 : 2.75), w: 8.1, h: 0.3,
            fontSize: 11, color: ACC, fontFace: FB, align: 'right', bold: true
          });
        }

        // Render 2 analytical context cards underneath the quote box for a complete, rich slide!
        if (hasCards) {
          const cards = slideItem.cards.slice(0, 2);
          const cardY = contentY + 1.75;
          const cardH = contentH - 1.75;
          const cW = 4.35;
          cards.forEach((card, cIdx) => {
            const px = 0.5 + cIdx * (cW + 0.3);
            slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
              x: px, y: cardY, w: cW, h: cardH,
              fill: { color: CARD }, line: { color: BDR, width: 1 }, rectRadius: 0.1
            });
            slide.addText(cleanTextForPptx(card.card_title || (cIdx === 0 ? 'Analytical Context' : 'Key Takeaways'), 40), {
              x: px + 0.2, y: cardY + 0.12, w: cW - 0.4, h: 0.35,
              fontSize: 12, bold: true, color: TXT, fontFace: FT
            });
            const bText = (card.points || []).slice(0, 3).map((pt: string) => ({
              text: cleanTextForPptx(String(pt), 100),
              options: { bullet: { type: 'bullet' }, color: TXT, fontSize: 9.5 }
            }));
            slide.addText(bText, {
              x: px + 0.2, y: cardY + 0.48, w: cW - 0.4, h: cardH - 0.55,
              fontFace: FB, color: TXT, paraSpaceAfter: 4
            });
          });
        }
      }

      // ── STATS SPOTLIGHT ──────────────────────────────────────────────────────
      else if (layoutType === 'stats_spotlight' && slideItem.stats && slideItem.stats.length > 0) {
        const stats = slideItem.stats.slice(0, 3);
        const sW = 2.7;
        const sGap = 0.45;
        stats.forEach((stat, sIdx) => {
          const sx = 0.5 + sIdx * (sW + sGap);
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: sx, y: contentY, w: sW, h: 3.6,
            fill: { color: CARD }, line: { color: sIdx === 0 ? ACC : BDR, width: sIdx === 0 ? 2 : 1 }, rectRadius: 0.12
          });
          slide.addShape(pptx.shapes.RECTANGLE, {
            x: sx, y: contentY, w: sW, h: 0.06, fill: { color: sIdx === 0 ? ACC : ACC2 }
          });
          slide.addText(cleanTextForPptx(stat.value, 15), {
            x: sx + 0.1, y: contentY + 0.5, w: sW - 0.2, h: 1.4,
            fontSize: 48, bold: true, color: sIdx === 0 ? ACC : TXT, fontFace: FT, align: 'center'
          });
          slide.addText(cleanTextForPptx(stat.label, 40), {
            x: sx + 0.1, y: contentY + 1.95, w: sW - 0.2, h: 0.45,
            fontSize: 14, bold: true, color: TXT, fontFace: FT, align: 'center'
          });
          if (stat.note) {
            slide.addText(cleanTextForPptx(stat.note, 60), {
              x: sx + 0.15, y: contentY + 2.5, w: sW - 0.3, h: 0.7,
              fontSize: 10, color: MUT, fontFace: FB, align: 'center'
            });
          }
        });
      }

      // ── ROADMAP TIMELINE ─────────────────────────────────────────────────────
      else if (layoutType === 'roadmap_timeline' && slideItem.roadmap_steps && slideItem.roadmap_steps.length > 0) {
        const steps = slideItem.roadmap_steps.slice(0, 5);
        const stepCount = steps.length;
        const sW = (9.0 - (stepCount - 1) * 0.25) / stepCount;
        const lineY = contentY + 0.5;

        // Horizontal connecting line
        slide.addShape(pptx.shapes.RECTANGLE, {
          x: 0.5, y: lineY - 0.02, w: 9.0, h: 0.04, fill: { color: BDR }
        });

        steps.forEach((step, sIdx) => {
          const sx = 0.5 + sIdx * (sW + 0.25);
          const dotX = sx + sW / 2 - 0.18;

          // Dot
          slide.addShape(pptx.shapes.OVAL, {
            x: dotX, y: lineY - 0.18, w: 0.36, h: 0.36,
            fill: { color: sIdx === 0 ? ACC : CARD }, line: { color: ACC, width: 2 }
          });

          // Phase label above dot
          slide.addText(cleanTextForPptx(step.phase, 12), {
            x: sx, y: lineY - 0.55, w: sW, h: 0.3,
            fontSize: 9, bold: true, color: ACC, align: 'center', fontFace: FT
          });

          // Card below dot (strictly bounded to Y=5.20 max)
          const cardY = lineY + 0.25;
          const cardH = 5.20 - cardY;

          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: sx, y: cardY, w: sW, h: cardH,
            fill: { color: CARD }, line: { color: sIdx === 0 ? ACC : BDR, width: sIdx === 0 ? 2 : 1 }, rectRadius: 0.1
          });
          slide.addText(cleanTextForPptx(step.title, 35), {
            x: sx + 0.1, y: cardY + 0.12, w: sW - 0.2, h: 0.4,
            fontSize: 11, bold: true, color: TXT, fontFace: FT
          });
          slide.addText(cleanTextForPptx(step.description, 90), {
            x: sx + 0.1, y: cardY + 0.55, w: sW - 0.2, h: cardH - 0.65,
            fontSize: 9.5, color: MUT, fontFace: FB, lineSpacingMultiple: 1.2
          });
        });
      }

      // ── DIAGRAM FLOW (PIPELINE / ARCHITECTURE) ───────────────────────────────
      else if (layoutType === 'diagram_flow') {
        const cards = (slideItem.cards || []).slice(0, 4);
        const stepCount = Math.max(2, cards.length);
        const bW = stepCount === 4 ? 1.85 : (stepCount === 3 ? 2.65 : 4.1);
        const gap = stepCount === 4 ? 0.52 : (stepCount === 3 ? 0.52 : 0.8);
        const startX = 0.5;

        cards.forEach((card, cIdx) => {
          const px = startX + cIdx * (bW + gap);

          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: px, y: contentY, w: bW, h: contentH - 0.2,
            fill: { color: CARD }, line: { color: cIdx === 0 ? ACC : BDR, width: cIdx === 0 ? 2 : 1 }, rectRadius: 0.12
          });
          // Top accent bar on card
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: px, y: contentY, w: bW, h: 0.06, fill: { color: cIdx === 0 ? ACC : ACC2 }, rectRadius: 0.1
          });
          // Step badge
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: px + 0.12, y: contentY + 0.12, w: 0.9, h: 0.3,
            fill: { color: cIdx === 0 ? ACC : BG }, line: { color: BDR, width: 1 }, rectRadius: 0.08
          });
          slide.addText(`STEP ${String(cIdx + 1).padStart(2, '0')}`, {
            x: px + 0.12, y: contentY + 0.12, w: 0.9, h: 0.3,
            fontSize: 8, bold: true, color: cIdx === 0 ? BG : ACC, align: 'center', fontFace: FT
          });
          // Card title
          slide.addText(cleanTextForPptx(card.card_title || `Phase ${cIdx + 1}`, 45), {
            x: px + 0.15, y: contentY + 0.5, w: bW - 0.3, h: 0.45,
            fontSize: 12, bold: true, color: TXT, fontFace: FT
          });
          // Bullets
          const bText = (card.points || []).slice(0, 5).map((pt: string) => ({
            text: cleanTextForPptx(String(pt), 110),
            options: { bullet: { type: 'bullet' }, color: TXT, fontSize: 9 }
          }));
          slide.addText(bText, {
            x: px + 0.15, y: contentY + 1.05, w: bW - 0.3, h: contentH - 1.2,
            fontFace: FB, color: TXT, paraSpaceAfter: 4
          });
          // Arrow connector
          if (cIdx < stepCount - 1) {
            slide.addText('➔', {
              x: px + bW + 0.02, y: contentY + contentH / 2 - 0.3, w: gap - 0.04, h: 0.5,
              fontSize: 20, bold: true, color: ACC, align: 'center', fontFace: FT
            });
          }
        });
      }

      // ── DATA TABLE (COMPARISON) ───────────────────────────────────────────────
      else if (layoutType === 'data_table' || slideItem.table_headers) {
        const rawHeaders = slideItem.table_headers || ['Feature', 'Traditional SaaS', 'QuickPitch'];
        const nCols = Math.min(3, Math.max(2, rawHeaders.length));
        const headers = rawHeaders.slice(0, nCols);
        // Ensure column widths add up exactly to 9.0 inches
        const colWidths = nCols === 3 ? [3.0, 3.0, 3.0] : [4.5, 4.5];

        const rowsData: string[][] = (slideItem.table_rows || []).length > 0
          ? slideItem.table_rows!
          : (slideItem.cards || []).map((card, ri) => [
              cleanTextForPptx(card.card_title || `Feature ${ri + 1}`, 40),
              cleanTextForPptx(card.points[0] || 'N/A', 50),
              cleanTextForPptx(card.points[1] || 'N/A', 50)
            ]);

        if (rowsData.length === 0) {
          // Fallback: no table data — render as split_cards instead
          const cards = (slideItem.cards || []).slice(0, 2);
          const cW = 4.35;
          cards.forEach((card, cIdx) => {
            const px = 0.5 + cIdx * (cW + 0.3);
            slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: px, y: contentY, w: cW, h: contentH - 0.1, fill: { color: CARD }, line: { color: cIdx === 0 ? ACC : BDR, width: cIdx === 0 ? 2 : 1 }, rectRadius: 0.12 });
            slide.addShape(pptx.shapes.RECTANGLE, { x: px, y: contentY, w: cW, h: 0.06, fill: { color: cIdx === 0 ? ACC : ACC2 } });
            slide.addText(cleanTextForPptx(card.card_title || `Section ${cIdx + 1}`, 45), { x: px + 0.2, y: contentY + 0.18, w: cW - 0.4, h: 0.5, fontSize: 14, bold: true, color: TXT, fontFace: FT });
            const bText = (card.points || []).slice(0, 5).map((pt: string) => ({ text: cleanTextForPptx(String(pt), 110), options: { bullet: { type: 'bullet' }, color: TXT, fontSize: 10.5 } }));
            slide.addText(bText, { x: px + 0.2, y: contentY + 0.78, w: cW - 0.4, h: contentH - 0.9, fontFace: FB, color: TXT, paraSpaceAfter: 6 });
          });
        } else {
          const tableRows: any[] = [
            headers.map((h: string) => ({
              text: cleanTextForPptx(String(h), 45),
              options: { fill: { color: ACC }, color: BG, bold: true, fontSize: 11, align: 'left', fontFace: FT }
            }))
          ];

          rowsData.slice(0, 7).forEach((rData: string[], rIdx: number) => {
            const rowBg = rIdx % 2 === 0 ? CARD : BG;
            const padded = rData.map(String).slice(0, nCols);
            while (padded.length < nCols) padded.push('—');
            tableRows.push(
              padded.map((cell: string, cIdx: number) => ({
                text: cell.replace(/[^\x20-\x7E\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2713\u2717\u2605]/g, '').slice(0, 65).trim() || '—',
                options: {
                  fill: { color: rowBg },
                  color: cIdx === 0 ? TXT : MUT,
                  fontSize: 10,
                  bold: cIdx === 0,
                  fontFace: FB,
                  align: 'left'
                }
              }))
            );
          });

          slide.addTable(tableRows, {
            x: 0.5,
            y: contentY,
            w: 9.0,
            border: { type: 'solid', pt: 1, color: BDR },
            rowH: 0.42
          });
        }
      }

      // ── FOUR COLUMNS (TECH STACK) ────────────────────────────────────────────
      else if (layoutType === 'four_columns') {
        const cards = (slideItem.cards || []).slice(0, 4);
        const cW = 2.0;
        const cGap = 0.33;
        const startX = 0.5;

        cards.forEach((card, cIdx) => {
          const px = startX + cIdx * (cW + cGap);
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: px, y: contentY, w: cW, h: contentH - 0.1,
            fill: { color: CARD }, line: { color: cIdx === 0 ? ACC : BDR, width: cIdx === 0 ? 2 : 1 }, rectRadius: 0.12
          });
          slide.addShape(pptx.shapes.RECTANGLE, {
            x: px, y: contentY, w: cW, h: 0.06,
            fill: { color: [ACC, ACC2, 'F59E0B', '06B6D4'][cIdx % 4] }
          });
          slide.addText(cleanTextForPptx(card.card_title || `Tool ${cIdx + 1}`, 25), {
            x: px + 0.1, y: contentY + 0.18, w: cW - 0.2, h: 0.45,
            fontSize: 12, bold: true, color: TXT, fontFace: FT
          });
          const bText = (card.points || []).slice(0, 6).map((pt: string) => ({
            text: cleanTextForPptx(String(pt), 90),
            options: { bullet: { type: 'bullet' }, color: TXT, fontSize: 9 }
          }));
          slide.addText(bText, {
            x: px + 0.1, y: contentY + 0.7, w: cW - 0.2, h: contentH - 0.8,
            fontFace: FB, color: TXT, paraSpaceAfter: 4
          });
        });
      }

      // ── THREE COLUMNS ────────────────────────────────────────────────────────
      else if (layoutType === 'three_columns') {
        const cards = (slideItem.cards || []).slice(0, 3);
        const cW = 2.85;
        const cGap = 0.22;
        const startX = 0.5;

        cards.forEach((card, cIdx) => {
          const px = startX + cIdx * (cW + cGap);
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: px, y: contentY, w: cW, h: contentH - 0.1,
            fill: { color: CARD }, line: { color: cIdx === 0 ? ACC : BDR, width: cIdx === 0 ? 2 : 1 }, rectRadius: 0.12
          });
          slide.addShape(pptx.shapes.RECTANGLE, {
            x: px + 0.15, y: contentY + 0.18, w: 0.55, h: 0.055,
            fill: { color: [ACC, ACC2, 'F59E0B'][cIdx % 3] }
          });
          slide.addText(cleanTextForPptx(card.card_title || `Pillar ${cIdx + 1}`, 38), {
            x: px + 0.15, y: contentY + 0.3, w: cW - 0.3, h: 0.45,
            fontSize: 13, bold: true, color: TXT, fontFace: FT
          });
          const bText = (card.points || []).slice(0, 5).map((pt: string) => ({
            text: cleanTextForPptx(String(pt), 110),
            options: { bullet: { type: 'bullet' }, color: TXT, fontSize: 10 }
          }));
          slide.addText(bText, {
            x: px + 0.15, y: contentY + 0.82, w: cW - 0.3, h: contentH - 0.95,
            fontFace: FB, color: TXT, paraSpaceAfter: 6
          });
        });
      }

      // ── COMPARISON SPLIT (SIDE-BY-SIDE VS CONTRAST) ──────────────────────────
      else if (layoutType === 'comparison_split') {
        const cards = (slideItem.cards || []).slice(0, 2);
        const cW = 4.2;
        const cGap = 0.6;
        const startX = 0.5;

        cards.forEach((card, cIdx) => {
          const px = startX + cIdx * (cW + cGap);
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: px, y: contentY, w: cW, h: contentH - 0.1,
            fill: { color: CARD }, line: { color: cIdx === 0 ? ACC : ACC2, width: 2 }, rectRadius: 0.12
          });
          slide.addShape(pptx.shapes.RECTANGLE, {
            x: px, y: contentY, w: cW, h: 0.06,
            fill: { color: cIdx === 0 ? ACC : ACC2 }
          });
          slide.addText(cleanTextForPptx(card.card_title || (cIdx === 0 ? 'Perspective A' : 'Perspective B'), 45), {
            x: px + 0.2, y: contentY + 0.18, w: cW - 0.4, h: 0.5,
            fontSize: 14, bold: true, color: cIdx === 0 ? ACC : TXT, fontFace: FT
          });
          const bText = (card.points || []).slice(0, 5).map((pt: string) => ({
            text: cleanTextForPptx(String(pt), 120),
            options: { bullet: { type: 'bullet' }, color: TXT, fontSize: 10 }
          }));
          slide.addText(bText, {
            x: px + 0.2, y: contentY + 0.78, w: cW - 0.4, h: contentH - 0.9,
            fontFace: FB, color: TXT, paraSpaceAfter: 6
          });
        });

        // Render central "VS" badge between the 2 cards
        slide.addShape(pptx.shapes.OVAL, {
          x: 4.65, y: contentY + (contentH - 0.1) / 2 - 0.35, w: 0.7, h: 0.7,
          fill: { color: ACC }, line: { color: BG, width: 2 }
        });
        slide.addText('VS', {
          x: 4.65, y: contentY + (contentH - 0.1) / 2 - 0.35, w: 0.7, h: 0.7,
          fontSize: 12, bold: true, color: BG, align: 'center', fontFace: FT
        });
      }

      // ── QUADRANT GRID (2x2 CARDS) ───────────────────────────────────────────
      else if (layoutType === 'quadrant_grid') {
        const cards = (slideItem.cards || []).slice(0, 4);
        const qW = 4.35;
        const qH = (contentH - 0.4) / 2;
        const positions = [
          { x: 0.5, y: contentY },
          { x: 5.15, y: contentY },
          { x: 0.5, y: contentY + qH + 0.2 },
          { x: 5.15, y: contentY + qH + 0.2 }
        ];

        cards.forEach((card, cIdx) => {
          const pos = positions[cIdx] || positions[0];
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: pos.x, y: pos.y, w: qW, h: qH,
            fill: { color: CARD }, line: { color: cIdx === 0 ? ACC : BDR, width: 1 }, rectRadius: 0.1
          });
          slide.addText(cleanTextForPptx(card.card_title || `Pillar 0${cIdx + 1}`, 35), {
            x: pos.x + 0.15, y: pos.y + 0.1, w: qW - 0.3, h: 0.35,
            fontSize: 12, bold: true, color: TXT, fontFace: FT
          });
          const bText = (card.points || []).slice(0, 3).map((pt: string) => ({
            text: cleanTextForPptx(String(pt), 90),
            options: { bullet: { type: 'bullet' }, color: TXT, fontSize: 9.5 }
          }));
          slide.addText(bText, {
            x: pos.x + 0.15, y: pos.y + 0.45, w: qW - 0.3, h: qH - 0.5,
            fontFace: FB, color: TXT, paraSpaceAfter: 4
          });
        });
      }

      // ── SPLIT CARDS (DEFAULT — 2 WIDE COLUMNS) ───────────────────────────────
      else {
        const cards = (slideItem.cards || []).slice(0, 2);
        const cW = 4.35;
        const cGap = 0.3;

        cards.forEach((card, cIdx) => {
          const px = 0.5 + cIdx * (cW + cGap);
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: px, y: contentY, w: cW, h: contentH - 0.1,
            fill: { color: CARD }, line: { color: cIdx === 0 ? ACC : BDR, width: cIdx === 0 ? 2 : 1 }, rectRadius: 0.12
          });
          slide.addShape(pptx.shapes.RECTANGLE, {
            x: px, y: contentY, w: cW, h: 0.06,
            fill: { color: cIdx === 0 ? ACC : ACC2 }
          });
          slide.addText(cleanTextForPptx(card.card_title || `Section ${cIdx + 1}`, 45), {
            x: px + 0.2, y: contentY + 0.18, w: cW - 0.4, h: 0.5,
            fontSize: 14, bold: true, color: TXT, fontFace: FT
          });
          const bText = (card.points || []).slice(0, 6).map((pt: string) => ({
            text: cleanTextForPptx(String(pt), 120),
            options: { bullet: { type: 'bullet' }, color: TXT, fontSize: 10.5 }
          }));
          slide.addText(bText, {
            x: px + 0.2, y: contentY + 0.78, w: cW - 0.4, h: contentH - 0.9,
            fontFace: FB, color: TXT, paraSpaceAfter: 7
          });
        });
      }
    });

    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' });
    const slideCount = slidesData.length + 1;
    console.log(`✅ Success! Returning ${activeTheme.name} PPTX with ${slideCount} slides.`);
    
    return new Response(pptxBuffer as Buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="QuickPitch_${activeTheme.name.replace(/\s+/g, '_')}_${slideCount}slides.pptx"`
      }
    });

  } catch (error: any) {
    console.error('Generate PPT Error:', error);
    return c.json({ error: error.message || 'Internal Server Error' }, 500);
  }
}
