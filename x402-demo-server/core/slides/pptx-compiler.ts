import PptxGenJS from 'pptxgenjs';
import type { SlideDeck, SlideItem, PresentationTheme } from '../schemas/slide.schema.js';
import { selectTheme } from './themes.js';
import { cleanTextForPptx } from '../transcript/sanitizer.js';

export interface CompilePptxResult {
  buffer: Buffer;
  slideCount: number;
  theme: PresentationTheme;
  fileName: string;
}

export async function compilePptx(
  deck: SlideDeck,
  requestedTheme?: string,
  contextText: string = ''
): Promise<CompilePptxResult> {
  const activeTheme = selectTheme(requestedTheme || deck.theme, contextText);
  const pptx: any = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  const BG   = activeTheme.bg;
  const CARD = activeTheme.cardBg;
  const ACC  = activeTheme.accent;
  const ACC2 = activeTheme.accentSecondary;
  const TXT  = activeTheme.textPrimary;
  const MUT  = activeTheme.textMuted;
  const BDR  = activeTheme.cardBorder;

  const FT   = activeTheme.fontTitle;
  const FB   = activeTheme.fontBody;

  const slidesData = deck.slides;
  const totalSlides = slidesData.length + 1; // +1 for cover slide

  // ════════════════════════════════════════════════════════════════════
  // 1. EXECUTIVE COVER SLIDE
  // ════════════════════════════════════════════════════════════════════
  const cover = pptx.addSlide();
  cover.background = { color: BG };

  // Subtle outer framing border
  cover.addShape(pptx.shapes.RECTANGLE, {
    x: 0.35, y: 0.35, w: 9.3, h: 4.925,
    fill: { color: BG }, line: { color: BDR, width: 1.5 }
  });

  // Top header gradient accent bar
  cover.addShape(pptx.shapes.RECTANGLE, {
    x: 0.35, y: 0.35, w: 9.3, h: 0.08,
    fill: { color: ACC }
  });

  // Left vertical accent bar
  cover.addShape(pptx.shapes.RECTANGLE, {
    x: 0.35, y: 0.35, w: 0.12, h: 4.925,
    fill: { color: ACC2 }
  });

  // Branding Pill Tag
  cover.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.85, y: 0.75, w: 3.2, h: 0.38,
    fill: { color: CARD }, line: { color: ACC, width: 1.5 }, rectRadius: 0.19
  });
  cover.addText('QUICKPITCH AI  ·  EXECUTIVE BRIEFING', {
    x: 0.85, y: 0.75, w: 3.2, h: 0.38,
    fontSize: 8.5, bold: true, color: ACC, align: 'center', fontFace: FT
  });

  // Main Cover Title
  const coverTitle = cleanTextForPptx(slidesData[0]?.title || 'Executive Presentation', 65);
  cover.addText(coverTitle, {
    x: 0.85, y: 1.35, w: 8.3, h: 1.7,
    fontSize: 34, bold: true, color: TXT, fontFace: FT, lineSpacingMultiple: 1.08
  });

  // Subtitle
  const coverSub = cleanTextForPptx(slidesData[0]?.subtitle || 'AI-Powered Presentation Deck · Strategic Briefing & Synthesis', 110);
  cover.addText(coverSub, {
    x: 0.85, y: 3.1, w: 8.3, h: 0.65,
    fontSize: 14, color: MUT, fontFace: FB, lineSpacingMultiple: 1.15
  });

  // Elegant divider line
  cover.addShape(pptx.shapes.RECTANGLE, {
    x: 0.85, y: 3.9, w: 8.3, h: 0.02, fill: { color: BDR }
  });

  // Metadata cards at bottom of cover
  const metaCards = [
    { label: 'TOTAL SLIDES', val: `${totalSlides} Slides`, color: TXT },
    { label: 'VISUAL THEME', val: activeTheme.name, color: ACC },
    { label: 'PREPARED BY', val: 'QuickPitch AI v2.5', color: ACC2 },
  ];

  metaCards.forEach((mc, idx) => {
    const mx = 0.85 + idx * 2.85;
    cover.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: mx, y: 4.12, w: 2.6, h: 0.82,
      fill: { color: CARD }, line: { color: BDR, width: 1 }, rectRadius: 0.08
    });
    // Top card accent
    cover.addShape(pptx.shapes.RECTANGLE, {
      x: mx, y: 4.12, w: 2.6, h: 0.03, fill: { color: idx === 0 ? ACC : idx === 1 ? ACC2 : BDR }
    });
    cover.addText(mc.label, {
      x: mx + 0.2, y: 4.22, w: 2.2, h: 0.25,
      fontSize: 8, color: MUT, fontFace: FB, bold: true
    });
    cover.addText(mc.val, {
      x: mx + 0.2, y: 4.47, w: 2.2, h: 0.38,
      fontSize: 11, bold: true, color: mc.color, fontFace: FT
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 2. EXECUTIVE CONTENT SLIDES
  // ════════════════════════════════════════════════════════════════════
  slidesData.forEach((slideItem: SlideItem, sIdx: number) => {
    const slide = pptx.addSlide();
    slide.background = { color: BG };

    // Outer framing border
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0.35, y: 0.35, w: 9.3, h: 4.925,
      fill: { color: BG }, line: { color: BDR, width: 1.5 }
    });

    // Top subtle accent line
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0.35, y: 0.35, w: 9.3, h: 0.05,
      fill: { color: sIdx % 2 === 0 ? ACC : ACC2 }
    });

    // Category pill badge
    const catText = cleanTextForPptx(slideItem.category || 'STRATEGIC INSIGHT', 32);
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.65, y: 0.55, w: 2.8, h: 0.32,
      fill: { color: CARD }, line: { color: ACC, width: 1.2 }, rectRadius: 0.16
    });
    slide.addText(catText.toUpperCase(), {
      x: 0.65, y: 0.55, w: 2.8, h: 0.32,
      fontSize: 8, bold: true, color: ACC, align: 'center', fontFace: FT
    });

    // Slide Counter Breadcrumb
    const slideNumStr = `SLIDE 0${sIdx + 2}  /  0${totalSlides}`;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 7.95, y: 0.55, w: 1.7, h: 0.32,
      fill: { color: CARD }, line: { color: BDR, width: 1 }, rectRadius: 0.08
    });
    slide.addText(slideNumStr, {
      x: 7.95, y: 0.55, w: 1.7, h: 0.32,
      fontSize: 8, color: MUT, align: 'center', fontFace: FT, bold: true
    });

    // Slide Title
    slide.addText(cleanTextForPptx(slideItem.title, 60), {
      x: 0.65, y: 0.98, w: 8.7, h: 0.52,
      fontSize: 21, bold: true, color: TXT, fontFace: FT
    });

    // Slide Subtitle
    if (slideItem.subtitle) {
      slide.addText(cleanTextForPptx(slideItem.subtitle, 105), {
        x: 0.65, y: 1.48, w: 8.7, h: 0.32,
        fontSize: 11, color: MUT, fontFace: FB
      });
    }

    // Divider line below header
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0.65, y: 1.84, w: 8.7, h: 0.02, fill: { color: BDR }
    });

    const contentY = 1.98;
    const contentH = 2.92;
    const cards = slideItem.cards && slideItem.cards.length > 0
      ? slideItem.cards
      : [{ card_title: 'Key Strategic Takeaways', points: ['Observation 1', 'Observation 2'] }];

    // ────────────────────────────────────────────────────────────────
    // LAYOUT VARIANT A: Single Featured Card
    // ────────────────────────────────────────────────────────────────
    if (cards.length === 1) {
      const card = cards[0];
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.65, y: contentY, w: 8.7, h: contentH,
        fill: { color: CARD }, line: { color: BDR, width: 1.2 }, rectRadius: 0.12
      });
      // Header Accent Strip
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0.65, y: contentY, w: 8.7, h: 0.06, fill: { color: ACC }
      });
      // Card Title
      slide.addText(cleanTextForPptx(card.card_title, 55), {
        x: 0.95, y: contentY + 0.22, w: 8.1, h: 0.42,
        fontSize: 16, bold: true, color: ACC, fontFace: FT
      });
      const bulletProps = (card.points || []).map(p => ({
        text: `▪  ${cleanTextForPptx(String(p), 180)}`,
        options: { color: TXT, fontSize: 12.5, lineSpacingMultiple: 1.25 }
      }));
      slide.addText(bulletProps as any, {
        x: 0.95, y: contentY + 0.72, w: 8.1, h: contentH - 0.9,
        fontFace: FB, paraSpaceAfter: 10
      });
    } 
    // ────────────────────────────────────────────────────────────────
    // LAYOUT VARIANT B: 2 Columns (50 / 50 Split)
    // ────────────────────────────────────────────────────────────────
    else if (cards.length === 2) {
      const cardW = 4.2;
      const gap = 0.3;

      cards.forEach((card, cIdx) => {
        const px = 0.65 + cIdx * (cardW + gap);
        const cardAcc = cIdx === 0 ? ACC : ACC2;

        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x: px, y: contentY, w: cardW, h: contentH,
          fill: { color: CARD }, line: { color: BDR, width: 1.2 }, rectRadius: 0.10
        });

        // Top Accent Strip
        slide.addShape(pptx.shapes.RECTANGLE, {
          x: px, y: contentY, w: cardW, h: 0.06, fill: { color: cardAcc }
        });

        // Card Index Tag
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x: px + 0.25, y: contentY + 0.18, w: 0.42, h: 0.3,
          fill: { color: BG }, line: { color: cardAcc, width: 1 }, rectRadius: 0.06
        });
        slide.addText(`0${cIdx + 1}`, {
          x: px + 0.25, y: contentY + 0.18, w: 0.42, h: 0.3,
          fontSize: 8.5, bold: true, color: cardAcc, align: 'center', fontFace: FT
        });

        // Card Title
        slide.addText(cleanTextForPptx(card.card_title || `Section ${cIdx + 1}`, 50), {
          x: px + 0.78, y: contentY + 0.16, w: cardW - 0.95, h: 0.38,
          fontSize: 14, bold: true, color: TXT, fontFace: FT
        });

        // Card Divider
        slide.addShape(pptx.shapes.RECTANGLE, {
          x: px + 0.25, y: contentY + 0.58, w: cardW - 0.5, h: 0.015, fill: { color: BDR }
        });

        // Bullet Points
        const bText = (card.points || []).slice(0, 5).map(pt => ({
          text: `▪  ${cleanTextForPptx(String(pt), 140)}`,
          options: { color: TXT, fontSize: 11, lineSpacingMultiple: 1.2 }
        }));
        slide.addText(bText as any, {
          x: px + 0.25, y: contentY + 0.68, w: cardW - 0.5, h: contentH - 0.8,
          fontFace: FB, paraSpaceAfter: 9
        });
      });
    }
    // ────────────────────────────────────────────────────────────────
    // LAYOUT VARIANT C: 3 Columns
    // ────────────────────────────────────────────────────────────────
    else {
      const cardCount = Math.min(cards.length, 3);
      const gap = 0.22;
      const totalW = 8.7;
      const cW = (totalW - gap * (cardCount - 1)) / cardCount;

      cards.slice(0, cardCount).forEach((card, cIdx) => {
        const px = 0.65 + cIdx * (cW + gap);
        const cardAcc = cIdx === 0 ? ACC : cIdx === 1 ? ACC2 : ACC;

        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x: px, y: contentY, w: cW, h: contentH,
          fill: { color: CARD }, line: { color: BDR, width: 1.2 }, rectRadius: 0.08
        });

        // Top Accent Strip
        slide.addShape(pptx.shapes.RECTANGLE, {
          x: px, y: contentY, w: cW, h: 0.06, fill: { color: cardAcc }
        });

        // Card Index Tag
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x: px + 0.18, y: contentY + 0.16, w: 0.38, h: 0.28,
          fill: { color: BG }, line: { color: cardAcc, width: 1 }, rectRadius: 0.05
        });
        slide.addText(`0${cIdx + 1}`, {
          x: px + 0.18, y: contentY + 0.16, w: 0.38, h: 0.28,
          fontSize: 8, bold: true, color: cardAcc, align: 'center', fontFace: FT
        });

        // Card Title
        slide.addText(cleanTextForPptx(card.card_title || `Section ${cIdx + 1}`, 38), {
          x: px + 0.62, y: contentY + 0.14, w: cW - 0.75, h: 0.36,
          fontSize: 12.5, bold: true, color: TXT, fontFace: FT
        });

        // Card Divider
        slide.addShape(pptx.shapes.RECTANGLE, {
          x: px + 0.18, y: contentY + 0.52, w: cW - 0.36, h: 0.015, fill: { color: BDR }
        });

        // Bullet Points
        const bText = (card.points || []).slice(0, 5).map(pt => ({
          text: `▪  ${cleanTextForPptx(String(pt), 110)}`,
          options: { color: TXT, fontSize: 10, lineSpacingMultiple: 1.18 }
        }));
        slide.addText(bText as any, {
          x: px + 0.18, y: contentY + 0.62, w: cW - 0.36, h: contentH - 0.75,
          fontFace: FB, paraSpaceAfter: 7
        });
      });
    }

    // Bottom Footer Branding Bar
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0.65, y: 5.0, w: 8.7, h: 0.015, fill: { color: BDR }
    });
    slide.addText('QUICKPITCH AI  ·  CONFIDENTIAL EXECUTIVE BRIEFING', {
      x: 0.65, y: 5.04, w: 6.0, h: 0.2,
      fontSize: 7.5, color: MUT, fontFace: FB
    });
    slide.addText(`${sIdx + 2}`, {
      x: 8.85, y: 5.04, w: 0.5, h: 0.2,
      fontSize: 8, color: ACC, align: 'right', fontFace: FT, bold: true
    });

    if (slideItem.speaker_notes) {
      slide.addNotes(cleanTextForPptx(slideItem.speaker_notes, 1500));
    }
  });

  const pptxBuffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  const fileName = `QuickPitch_${activeTheme.name.replace(/\s+/g, '_')}_${totalSlides}slides.pptx`;

  return {
    buffer: pptxBuffer,
    slideCount: totalSlides,
    theme: activeTheme,
    fileName,
  };
}
