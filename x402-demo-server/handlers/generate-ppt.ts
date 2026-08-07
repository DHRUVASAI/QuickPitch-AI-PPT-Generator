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
  layout_type?: 'split_cards' | 'three_columns' | 'hero_quote' | 'roadmap_steps' | 'diagram_flow' | 'data_table';
  quote?: string;
  quote_author?: string;
  table_headers?: string[];
  table_rows?: string[][];
  cards: {
    card_title: string;
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
  return cleanTextForPptx(
    textContext
      .replace(/\[Music\]|\[Applause\]|\[Laughter\]|\[Audio\]|\[Video\]/gi, '')
      .replace(/this program is brought to you by.*?(?:stanford|university|sponsor|channel|\.)/gi, '')
      .replace(/subscribe to (?:my|our) channel|like and subscribe|welcome back to/gi, '')
      .replace(/please visit us at.*?(?:edu|com|org|\s)/gi, '')
      .replace(/Source Video Title:|Video Description & Context:|Presentation request for/gi, ''),
    20000
  );
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
    const lower = s.toLowerCase();
    if (lower.includes('brought to you by') || lower.includes('visit us at') || lower.includes('music') || lower.includes('subscribe')) return false;
    return true;
  });

  if (rawSentences.length <= 6) {
    const words = cleanText.split(/\s+/);
    rawSentences = [];
    for (let i = 0; i < words.length; i += 14) {
      const chunk = words.slice(i, i + 14).join(' ').trim();
      if (chunk.length > 10 && !chunk.toLowerCase().includes('brought to you by')) {
        rawSentences.push(chunk);
      }
    }
  }

  // Strictly truncate every sentence to max 110 chars
  const sentences = rawSentences.map(s => s.length > 110 ? s.slice(0, 107) + '...' : s);
  
  const title = (topicHint && topicHint !== 'YouTube Presentation' && topicHint !== 'Presentation Deck' ? topicHint : (sentences[0] || "Executive Presentation")).slice(0, 55);

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

  const bestQuote = (quoteCandidates[Math.floor(quoteCandidates.length / 2)] || quoteCandidates[0] || sentences[1] || "Innovation distinguishes between a leader and a follower.").slice(0, 130);

  const categories = [
    "PROBLEM STATEMENT", "TECHNICAL ARCHITECTURE", "DATASETS & METRICS",
    "HERO STATEMENT", "SYSTEM PIPELINE", "CASE STUDIES & IMPACT",
    "EXECUTION ROADMAP", "GOVERNANCE & RISKS", "FUTURE OUTLOOK", "CONCLUSION"
  ];

  const layouts: ("split_cards" | "three_columns" | "hero_quote")[] = [
    "split_cards", "three_columns", "split_cards", "hero_quote",
    "three_columns", "split_cards", "three_columns", "split_cards"
  ];

  const slides: SlideItem[] = [];

  for (let i = 0; i < targetContentSlides; i++) {
    const bucket = getBucket(i);
    const cat = categories[i % categories.length];
    const layout = layouts[i % layouts.length];
    
    if (layout === 'hero_quote') {
      slides.push({
        title: (bucket[0] || `Core Thesis & Strategic Principle`).slice(0, 50),
        subtitle: (bucket[1] || "Central philosophy statement from the source analysis").slice(0, 75),
        category: cat,
        layout_type: "hero_quote",
        quote: (bucket[0] || bestQuote).slice(0, 130),
        cards: []
      });
    } else if (layout === 'three_columns') {
      slides.push({
        title: (bucket[0] || `Strategic Pillar 0${i + 1}`).slice(0, 50),
        subtitle: (bucket[1] || "Key structural takeaways and analytical pillars").slice(0, 75),
        category: cat,
        layout_type: "three_columns",
        cards: [
          { card_title: "Pillar A: Scope", points: [bucket[0] || "Primary technical scope and objective"] },
          { card_title: "Pillar B: Execution", points: [bucket[1] || "Core methodology and implementation"] },
          { card_title: "Pillar C: Metrics", points: [bucket[2] || "Measurable benchmark and evaluation"] }
        ]
      });
    } else {
      slides.push({
        title: (bucket[0] || `Analysis Section 0${i + 1}`).slice(0, 50),
        subtitle: (bucket[1] || "Detailed breakdown of technical concepts and insights").slice(0, 75),
        category: cat,
        layout_type: "split_cards",
        cards: [
          { card_title: "Core Analysis", points: bucket.slice(0, 3).length > 0 ? bucket.slice(0, 3) : ["Detailed evaluation of primary topics", "Systematic analysis of key claims"] },
          { card_title: "Strategic Impact", points: bucket.slice(3, 6).length > 0 ? bucket.slice(3, 6) : ["Practical implications for stakeholders", "Long-term value creation and benchmarks"] }
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

async function generateSlideStructure(textContext: string, topicHint?: string, targetTotalSlides: number = 7): Promise<SlideItem[]> {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const targetContentCount = Math.max(6, targetTotalSlides - 1);

  const prompt = `You are a world-class executive presentation designer at Gamma App / Claude Artifacts.
Analyze the provided transcript or topic and design a comprehensive ${targetContentCount} slide executive presentation deck.

CRITICAL SLIDE COUNT REQUIREMENT: You MUST generate EXACTLY ${targetContentCount} content slide objects in the JSON array.

CRITICAL NARRATIVE PROGRESSION (STRICT 8-STEP STORY ARC):
Your presentation MUST tell a logical, non-repetitive narrative story across slides:
1. Executive Overview & Problem Context (Why traditional approaches fail or key challenge)
2. Core Technical Innovation & Model Architecture (Specific model names, algorithms, mechanisms)
3. Dataset & Empirical Benchmarks (Specific datasets, metrics, percentage accuracy, throughput)
4. Key Thesis Statement & Hero Takeaway (Full-width quotation or central thesis)
5. Practical System Architecture & Integration (APIs, workflows, pipeline components)
6. Real-World Case Studies & Applications (Concrete deployment scenarios, domain applications)
7. Phased Implementation Roadmap (Phase 1 Initiate, Phase 2 Execute, Phase 3 Optimize)
8. Future Vision & Conclusion (Next milestones, scaling, impact)

ANTI-REPETITION MANDATE (STRICT):
- Every slide MUST cover a COMPLETELY DIFFERENT topic.
- NEVER repeat general statements like "Foundation models are powerful" across multiple slides.
- Extract SPECIFIC model names (e.g. Prithvi, SatMAE, Clay, DOFA, LLaMA-3, ResNet, PyTorch, Hono, Algorand x402), dataset names (e.g. Sentinel-2, Landsat, SAR, ImageNet), and exact metrics (% accuracy, speedup, latency).
- Each slide MUST have a unique title, unique subheadings, and distinct bullet points.

CRITICAL LANGUAGE REQUIREMENT: ALL text MUST be STRICTLY IN ENGLISH.

NO FILLER RULE: NEVER include video intro filler, sponsor text, '[Music]', '[Applause]', 'brought to you by', 'visit us at', or channel intros in any slide or quote.

TEXT LENGTH CONSTRAINTS: 
- Slide Title: Max 50 characters.
- Subtitle: Max 75 characters.
- Card Header: Max 22 characters.
- Bullet Point: Max 105 characters per point. Include 2 to 3 points per card.

DYNAMIC LAYOUT INSTRUCTION: Assign a dynamic "layout_type" to each slide based on its specific semantic content:
- "split_cards" (2 wide columns for deep dive analysis)
- "three_columns" (3 side-by-side metric pillars or core lessons)
- "hero_quote" (1 full-width highlighted quote / thesis statement)
- "diagram_flow" (3 to 4 sequential connected process flowchart cards for system architecture, workflows, or pipelines)
- "data_table" (2 to 3 column comparison table for datasets, empirical benchmarks, or quantitative metrics)

Return ONLY a raw JSON array of ${targetContentCount} slide objects:
[
  {
    "title": "Specific Short Slide Title",
    "subtitle": "Short subtitle summarizing takeaway",
    "category": "KEY LESSON | ARCHITECTURE | DATASETS | QUOTE | ROADMAP",
    "layout_type": "split_cards | three_columns | hero_quote | diagram_flow | data_table",
    "quote": "Meaningful core speech quote max 130 characters",
    "table_headers": ["Metric / Benchmark", "Baseline Model", "QuickPitch AI Benchmark"],
    "table_rows": [["Prithvi-100M", "81.2%", "94.5% Accuracy (+13.3%)"], ["SatMAE-Base", "120ms", "45ms Latency (2.6x Speed)"]],
    "cards": [
      {
        "card_title": "Card Title 1",
        "points": ["Short point 1 max 100 chars", "Short point 2 max 100 chars"]
      },
      {
        "card_title": "Card Title 2",
        "points": ["Short point 1 max 100 chars", "Short point 2 max 100 chars"]
      }
    ]
  }
]

Source Context:
${sanitizeTranscriptText(textContext).slice(0, 16000)}`;

  let rawOutput = '';

  if (groqKey) {
    try {
      console.log('Using Groq (llama-3.1-8b-instant) for multi-layout slide generation...');
      const groqClient = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
      const response = await groqClient.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 1600
      });
      rawOutput = response.choices[0].message.content || '[]';
    } catch (err: any) {
      console.warn('Groq llama-3.1-8b-instant error, trying llama-3.3-70b-versatile:', err.message);
      try {
        const groqClient = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
        const response = await groqClient.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
        });
        rawOutput = response.choices[0].message.content || '[]';
      } catch (err2: any) {
        console.warn('Groq 70b fallback error:', err2.message);
      }
    }
  }

  if (!rawOutput && openaiKey) {
    try {
      console.log('Using OpenAI GPT-4o for generation...');
      const openaiClient = new OpenAI({ apiKey: openaiKey });
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      });
      rawOutput = response.choices[0].message.content || '[]';
    } catch (err: any) {
      console.warn('OpenAI generation error:', err.message);
    }
  }

  if (!rawOutput && geminiKey) {
    try {
      console.log('Using Google Gemini for generation...');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      rawOutput = result.response.text();
    } catch (err: any) {
      console.warn('Gemini generation error:', err.message);
    }
  }

  rawOutput = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
  const jsonArrayMatch = rawOutput.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (jsonArrayMatch) {
    rawOutput = jsonArrayMatch[0];
  }

  try {
    const parsed = JSON.parse(rawOutput);
    if (Array.isArray(parsed) && parsed.length >= 3) {
      console.log(`Successfully parsed AI JSON with ${parsed.length} slides!`);
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse AI JSON, using smart dynamic NLP text extractor...');
  }

  return buildDynamicNLPDeck(textContext, topicHint, targetTotalSlides);
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

      const fetchWithTimeout = (promise: Promise<any>, timeoutMs: number = 1500) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), timeoutMs))
        ]);
      };

      try {
        const transcriptLines: any = await fetchWithTimeout(YoutubeTranscript.fetchTranscript(url, { lang: 'en' }), 1500);
        transcript = `Video Title: ${meta.title || 'YouTube Video'}\nVideo Description: ${meta.description}\nTranscript: ` + transcriptLines.map((t: any) => t.text).join(' ');
      } catch (err) {
        try {
          const transcriptLines: any = await fetchWithTimeout(YoutubeTranscript.fetchTranscript(url), 1500);
          transcript = `Video Title: ${meta.title || 'YouTube Video'}\nVideo Description: ${meta.description}\nTranscript: ` + transcriptLines.map((t: any) => t.text).join(' ');
        } catch (e2) {
          console.warn('YouTube transcript fast fallback triggered. Using video metadata (title + description)...');
          topicHint = meta.title || 'YouTube Video Analysis';
          transcript = `Video Title: ${meta.title || 'YouTube Video'}\nVideo Description & Context: ${meta.description || 'Comprehensive overview of this video topic'}`;
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

    const COLOR_BG = activeTheme.bg;
    const COLOR_CARD_BG = activeTheme.cardBg;
    const COLOR_ACCENT = activeTheme.accent;
    const COLOR_PURPLE = activeTheme.accentSecondary;
    const COLOR_TEXT_PRIMARY = activeTheme.textPrimary;
    const COLOR_TEXT_MUTED = activeTheme.textMuted;
    const COLOR_CARD_BORDER = activeTheme.cardBorder;
    const FONT_TITLE = activeTheme.fontTitle;
    const FONT_BODY = activeTheme.fontBody;

    // ==========================================
    // SLIDE 1: COVER SLIDE
    // ==========================================
    const cover = pptx.addSlide();
    cover.background = { color: COLOR_BG };

    cover.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 10.0, h: 0.1, fill: { color: COLOR_ACCENT } });

    cover.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.6, y: 0.8, w: 2.4, h: 0.35,
      fill: { color: COLOR_CARD_BG },
      line: { color: COLOR_ACCENT, width: 1 }
    });
    cover.addText(`QUICKPITCH · ${activeTheme.name.toUpperCase()}`, {
      x: 0.6, y: 0.8, w: 2.4, h: 0.35,
      fontSize: 9, bold: true, color: COLOR_ACCENT, align: 'center', fontFace: FONT_TITLE
    });

    const rawCoverTitle = cleanTextForPptx(slidesData[0]?.title && slidesData[0].title !== "Executive Presentation" ? slidesData[0].title : topicHint, 55);
    cover.addText(rawCoverTitle, {
      x: 0.6, y: 1.4, w: 8.8, h: 1.5,
      fontSize: 32, bold: true, color: COLOR_TEXT_PRIMARY, fontFace: FONT_TITLE
    });

    const subTitle = cleanTextForPptx(slidesData[0]?.subtitle || 'Key Takeaways & Strategic Summary', 85);
    cover.addText(subTitle, {
      x: 0.6, y: 3.1, w: 8.8, h: 0.8,
      fontSize: 16, color: COLOR_TEXT_MUTED, fontFace: FONT_BODY
    });

    cover.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.6, y: 4.4, w: 8.8, h: 0.6,
      fill: { color: COLOR_CARD_BG },
      line: { color: COLOR_CARD_BORDER, width: 1 }
    });
    cover.addText(`⚡ Powered by Algorand x402 Micropayments & AI Engine · Theme: ${activeTheme.name}`, {
      x: 0.8, y: 4.4, w: 8.4, h: 0.6,
      fontSize: 11, color: COLOR_TEXT_MUTED, align: 'left', fontFace: FONT_BODY
    });

    // ==========================================
    // CONTENT SLIDES (Dynamic Layout Switcher with Strict Formatting Bounds)
    // ==========================================
    slidesData.forEach((slideItem, index) => {
      const slide = pptx.addSlide();
      slide.background = { color: COLOR_BG };

      const categoryTag = cleanTextForPptx((slideItem.category || `SECTION 0${index + 1}`).toUpperCase(), 30);
      slide.addText(categoryTag, {
        x: 0.5, y: 0.3, w: 9.0, h: 0.25,
        fontSize: 10, bold: true, color: COLOR_ACCENT, fontFace: FONT_TITLE
      });

      const slideTitleText = cleanTextForPptx(slideItem.title || `Key Insight 0${index + 1}`, 55);
      slide.addText(slideTitleText, {
        x: 0.5, y: 0.55, w: 9.0, h: 0.5,
        fontSize: 22, bold: true, color: COLOR_TEXT_PRIMARY, fontFace: FONT_TITLE
      });

      if (slideItem.subtitle) {
        const slideSubText = cleanTextForPptx(slideItem.subtitle, 85);
        slide.addText(slideSubText, {
          x: 0.5, y: 1.05, w: 9.0, h: 0.35,
          fontSize: 12, color: COLOR_TEXT_MUTED, fontFace: FONT_BODY
        });
      }

      const layoutType = slideItem.layout_type || (index % 2 === 0 ? 'split_cards' : 'three_columns');

      // LAYOUT A: HERO QUOTE BANNER
      if (layoutType === 'hero_quote' || slideItem.quote) {
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x: 0.5, y: 1.5, w: 9.0, h: 3.6,
          fill: { color: COLOR_CARD_BG },
          line: { color: COLOR_ACCENT, width: 2 }
        });
        slide.addText('“', {
          x: 0.8, y: 1.6, w: 1.0, h: 0.8,
          fontSize: 54, bold: true, color: COLOR_ACCENT, fontFace: FONT_TITLE
        });
        const quoteText = (slideItem.quote || slideItem.subtitle || slideItem.title).slice(0, 140);
        slide.addText(quoteText, {
          x: 1.0, y: 2.2, w: 8.0, h: 2.0,
          fontSize: 18, italic: true, color: COLOR_TEXT_PRIMARY, fontFace: FONT_TITLE, align: 'center'
        });
      }
      // LAYOUT B: PROCESS FLOWCHART DIAGRAM
      else if (layoutType === 'diagram_flow') {
        const cards = (slideItem.cards || []).slice(0, 4);
        const stepCount = Math.max(3, cards.length);
        const boxWidth = stepCount === 4 ? 1.85 : 2.65;
        const gap = stepCount === 4 ? 0.53 : 0.52;
        const startX = 0.5;

        cards.forEach((card, cIdx) => {
          const posX = startX + cIdx * (boxWidth + gap);
          
          // Process Card Box
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: posX, y: 1.5, w: boxWidth, h: 3.6,
            fill: { color: COLOR_CARD_BG },
            line: { color: cIdx === 0 ? COLOR_ACCENT : COLOR_CARD_BORDER, width: cIdx === 0 ? 2 : 1 }
          });

          // Step Badge Pill
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: posX + 0.15, y: 1.7, w: 0.8, h: 0.3,
            fill: { color: cIdx === 0 ? COLOR_ACCENT : COLOR_BG },
            line: { color: COLOR_CARD_BORDER, width: 1 }
          });
          slide.addText(`STEP 0${cIdx + 1}`, {
            x: posX + 0.15, y: 1.7, w: 0.8, h: 0.3,
            fontSize: 8.5, bold: true, color: cIdx === 0 ? COLOR_BG : COLOR_ACCENT, align: 'center', fontFace: FONT_TITLE
          });

          // Card Title
          slide.addText((card.card_title || `Phase 0${cIdx + 1}`).slice(0, 22), {
            x: posX + 0.15, y: 2.15, w: boxWidth - 0.3, h: 0.4,
            fontSize: 12, bold: true, color: COLOR_TEXT_PRIMARY, fontFace: FONT_TITLE
          });

          // Card Bullet Points
          const bulletText = (card.points || []).slice(0, 3).map((pt: string) => ({
            text: (typeof pt === 'string' ? pt : String(pt)).slice(0, 95).trim(),
            options: { bullet: true, color: COLOR_TEXT_PRIMARY, fontSize: 9.5 }
          }));
          slide.addText(bulletText, {
            x: posX + 0.15, y: 2.6, w: boxWidth - 0.3, h: 2.3,
            fontFace: FONT_BODY, paraSpaceAfter: 4
          });

          // Directional Connector Arrow between boxes
          if (cIdx < stepCount - 1) {
            const arrowX = posX + boxWidth + 0.05;
            slide.addText('──▶', {
              x: arrowX, y: 3.0, w: gap - 0.1, h: 0.4,
              fontSize: 14, bold: true, color: COLOR_ACCENT, align: 'center', fontFace: FONT_TITLE
            });
          }
        });
      }
      // LAYOUT C: BENCHMARK DATA TABLE
      else if (layoutType === 'data_table' || slideItem.table_headers) {
        const rawHeaders = slideItem.table_headers || ["Metric / Benchmark", "Baseline Model", "QuickPitch AI Benchmark"];
        const numCols = Math.max(2, Math.min(3, rawHeaders.length));
        const headers = rawHeaders.slice(0, numCols);
        const colWidths = numCols === 3 ? [3.0, 3.0, 3.0] : [4.5, 4.5];

        const rowsData = slideItem.table_rows || (slideItem.cards || []).map((card, idx) => [
          card.card_title || `Metric 0${idx + 1}`,
          (card.points[0] || 'Standard Baseline').slice(0, 45),
          (card.points[1] || '94.5% High Accuracy').slice(0, 45)
        ]);

        const tableRows: any[] = [
          headers.map((h: string) => ({
            text: String(h || '').slice(0, 40),
            options: { fill: { color: COLOR_ACCENT }, color: COLOR_BG, bold: true, fontSize: 11, align: 'left', fontFace: FONT_TITLE }
          }))
        ];

        rowsData.slice(0, 5).forEach((rData: string[], rIdx: number) => {
          const rowBg = rIdx % 2 === 0 ? COLOR_CARD_BG : COLOR_BG;
          const paddedRow = rData.slice(0, numCols);
          while (paddedRow.length < numCols) {
            paddedRow.push('—');
          }

          tableRows.push(
            paddedRow.map((cellText: string, cIdx: number) => ({
              text: String(cellText || '').replace(/[^\x20-\x7E]/g, '').slice(0, 60).trim(),
              options: {
                fill: { color: rowBg },
                color: cIdx === 0 ? COLOR_TEXT_PRIMARY : COLOR_TEXT_MUTED,
                fontSize: 10,
                bold: cIdx === 0,
                fontFace: FONT_BODY
              }
            }))
          );
        });

        slide.addTable(tableRows, {
          x: 0.5, y: 1.5, w: 9.0, h: 3.6,
          colW: colWidths,
          border: { type: 'solid', pt: 1, color: COLOR_CARD_BORDER }
        });
      }
      // LAYOUT D: 3 COLUMN PILLARS
      else if (layoutType === 'three_columns') {
        const cards = (slideItem.cards || []).slice(0, 3);
        const cardWidth = 2.8;
        const cardGap = 0.3;
        const startX = 0.5;

        cards.forEach((card, cIdx) => {
          const posX = startX + cIdx * (cardWidth + cardGap);
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: posX, y: 1.5, w: cardWidth, h: 3.7,
            fill: { color: COLOR_CARD_BG },
            line: { color: COLOR_CARD_BORDER, width: 1 }
          });
          slide.addShape(pptx.shapes.RECTANGLE, {
            x: posX + 0.15, y: 1.7, w: 0.5, h: 0.05,
            fill: { color: cIdx === 0 ? COLOR_ACCENT : (cIdx === 1 ? COLOR_PURPLE : 'F59E0B') }
          });
          const cardHead = (card.card_title || `Pillar 0${cIdx + 1}`).slice(0, 25);
          slide.addText(cardHead, {
            x: posX + 0.15, y: 1.85, w: cardWidth - 0.3, h: 0.4,
            fontSize: 13, bold: true, color: COLOR_TEXT_PRIMARY, fontFace: FONT_TITLE
          });
          const bulletText = (card.points || []).slice(0, 3).map((pt: string) => ({
            text: (typeof pt === 'string' ? pt : String(pt)).slice(0, 110).trim(),
            options: { bullet: true, color: COLOR_TEXT_PRIMARY, fontSize: 10 }
          }));
          slide.addText(bulletText, {
            x: posX + 0.15, y: 2.3, w: cardWidth - 0.3, h: 2.8,
            fontFace: FONT_BODY, paraSpaceAfter: 6
          });
        });
      }
      // LAYOUT C: SPLIT 2 CARDS
      else {
        const cards = (slideItem.cards || []).slice(0, 2);
        const cardWidth = 4.35;
        const cardGap = 0.3;
        const startX = 0.5;

        cards.forEach((card, cIdx) => {
          const posX = startX + cIdx * (cardWidth + cardGap);
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: posX, y: 1.5, w: cardWidth, h: 3.7,
            fill: { color: COLOR_CARD_BG },
            line: { color: COLOR_CARD_BORDER, width: 1 }
          });
          slide.addShape(pptx.shapes.RECTANGLE, {
            x: posX + 0.2, y: 1.7, w: 0.6, h: 0.05,
            fill: { color: cIdx === 0 ? COLOR_ACCENT : COLOR_PURPLE }
          });
          const cardHead = (card.card_title || `Insight 0${cIdx + 1}`).slice(0, 30);
          slide.addText(cardHead, {
            x: posX + 0.2, y: 1.8, w: cardWidth - 0.4, h: 0.4,
            fontSize: 14, bold: true, color: COLOR_TEXT_PRIMARY, fontFace: FONT_TITLE
          });
          const bulletText = (card.points || []).slice(0, 3).map((pt: string) => ({
            text: (typeof pt === 'string' ? pt : String(pt)).slice(0, 115).trim(),
            options: { bullet: true, color: COLOR_TEXT_PRIMARY, fontSize: 11 }
          }));
          slide.addText(bulletText, {
            x: posX + 0.2, y: 2.25, w: cardWidth - 0.4, h: 2.85,
            fontFace: FONT_BODY, paraSpaceAfter: 8
          });
        });
      }
    });

    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' });
    console.log(`Success! Returning ${activeTheme.name} Multi-Layout PPTX file.`);
    
    return new Response(pptxBuffer as Buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="QuickPitch_${activeTheme.name.replace(/\s+/g, '_')}.pptx"`
      }
    });

  } catch (error: any) {
    console.error('Generate PPT Error:', error);
    return c.json({ error: error.message || 'Internal Server Error' }, 500);
  }
}
