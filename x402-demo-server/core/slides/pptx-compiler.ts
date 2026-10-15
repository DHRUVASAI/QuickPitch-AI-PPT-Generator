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
  // 1. COVER SLIDE
  // ════════════════════════════════════════════════════════════════════
  const cover = pptx.addSlide();
  cover.background = { color: BG };

  // Decorative border
  cover.addShape(pptx.shapes.RECTANGLE, {
    x: 0.18, y: 0.22, w: 9.64, h: 5.185,
    fill: { color: BG }, line: { color: BDR, width: 1 }
  });

  // Left accent strip
  cover.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0.22, w: 0.08, h: 5.0, fill: { color: ACC } });

  // Badge pill
  cover.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 0.55, w: 3.0, h: 0.38,
    fill: { color: CARD }, line: { color: ACC, width: 1.5 }, rectRadius: 0.15
  });
  cover.addText('QUICKPITCH  ·  AI PRESENTATION', {
    x: 0.5, y: 0.55, w: 3.0, h: 0.38,
    fontSize: 9, bold: true, color: ACC, align: 'center', fontFace: FT
  });

  // Title
  const coverTitle = cleanTextForPptx(slidesData[0]?.title || 'Executive Presentation', 60);
  cover.addText(coverTitle, {
    x: 0.5, y: 1.15, w: 8.8, h: 1.6,
    fontSize: 38, bold: true, color: TXT, fontFace: FT, lineSpacingMultiple: 1.1
  });

  // Subtitle
  const coverSub = cleanTextForPptx(slidesData[0]?.subtitle || 'AI-Powered Presentation Deck', 100);
  cover.addText(coverSub, {
    x: 0.5, y: 2.85, w: 8.8, h: 0.55,
    fontSize: 15, color: MUT, fontFace: FB
  });

  // Divider
  cover.addShape(pptx.shapes.RECTANGLE, {
    x: 0.5, y: 3.5, w: 9.0, h: 0.025, fill: { color: BDR }
  });

  // Meta pills
  cover.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 3.75, w: 2.2, h: 0.7,
    fill: { color: CARD }, line: { color: BDR, width: 1 }, rectRadius: 0.08
  });
  cover.addText('SLIDES', { x: 0.6, y: 3.8, w: 2.0, h: 0.25, fontSize: 8, color: MUT, fontFace: FB, bold: true });
  cover.addText(`${totalSlides} Slides Total`, { x: 0.6, y: 4.05, w: 2.0, h: 0.32, fontSize: 11, bold: true, color: TXT, fontFace: FT });

  cover.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 2.9, y: 3.75, w: 2.2, h: 0.7,
    fill: { color: CARD }, line: { color: BDR, width: 1 }, rectRadius: 0.08
  });
  cover.addText('PALETTE', { x: 3.0, y: 3.8, w: 2.0, h: 0.25, fontSize: 8, color: MUT, fontFace: FB, bold: true });
  cover.addText(activeTheme.name, { x: 3.0, y: 4.05, w: 2.0, h: 0.32, fontSize: 11, bold: true, color: ACC, fontFace: FT });

  // ════════════════════════════════════════════════════════════════════
  // 2. CONTENT SLIDES
  // ════════════════════════════════════════════════════════════════════
  slidesData.forEach((slideItem: SlideItem, sIdx: number) => {
    const slide = pptx.addSlide();
    slide.background = { color: BG };

    // Outer border
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0.18, y: 0.22, w: 9.64, h: 5.185,
      fill: { color: BG }, line: { color: BDR, width: 1 }
    });

    // Left accent strip
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0, y: 0.22, w: 0.06, h: 5.0,
      fill: { color: sIdx % 2 === 0 ? ACC : ACC2 }
    });

    // Category badge
    const catText = cleanTextForPptx(slideItem.category || 'STRATEGIC INSIGHT', 30);
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.5, y: 0.38, w: 2.4, h: 0.32,
      fill: { color: CARD }, line: { color: ACC, width: 1 }, rectRadius: 0.08
    });
    slide.addText(catText.toUpperCase(), {
      x: 0.5, y: 0.38, w: 2.4, h: 0.32,
      fontSize: 8, bold: true, color: ACC, align: 'center', fontFace: FT
    });

    // Slide Counter
    const slideNumStr = `0${sIdx + 2} / 0${totalSlides}`;
    slide.addText(slideNumStr, {
      x: 8.5, y: 0.38, w: 1.0, h: 0.32,
      fontSize: 9, color: MUT, align: 'right', fontFace: FT, bold: true
    });

    // Title
    slide.addText(cleanTextForPptx(slideItem.title, 55), {
      x: 0.5, y: 0.76, w: 9.0, h: 0.55,
      fontSize: 20, bold: true, color: TXT, fontFace: FT
    });

    // Subtitle
    if (slideItem.subtitle) {
      slide.addText(cleanTextForPptx(slideItem.subtitle, 95), {
        x: 0.5, y: 1.28, w: 9.0, h: 0.38,
        fontSize: 11, color: MUT, fontFace: FB
      });
    }

    // Divider
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0.5, y: 1.70, w: 9.0, h: 0.02, fill: { color: BDR }
    });

    const contentY = 1.84;
    const contentH = 3.32;
    const cards = slideItem.cards && slideItem.cards.length > 0
      ? slideItem.cards
      : [{ card_title: 'Key Takeaways', points: ['Observation 1', 'Observation 2'] }];

    // Render cards
    if (cards.length === 1) {
      const card = cards[0];
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.5, y: contentY, w: 9.0, h: contentH,
        fill: { color: CARD }, line: { color: BDR, width: 1 }, rectRadius: 0.12
      });
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0.5, y: contentY, w: 9.0, h: 0.06, fill: { color: ACC }
      });
      slide.addText(cleanTextForPptx(card.card_title, 50), {
        x: 0.8, y: contentY + 0.25, w: 8.4, h: 0.45,
        fontSize: 16, bold: true, color: TXT, fontFace: FT
      });
      const bulletProps = (card.points || []).map(p => ({
        text: cleanTextForPptx(String(p), 160),
        options: { bullet: true, color: TXT, fontSize: 12 }
      }));
      slide.addText(bulletProps as any, {
        x: 0.8, y: contentY + 0.8, w: 8.4, h: contentH - 1.0,
        fontFace: FB, color: TXT, paraSpaceAfter: 8
      });
    } else {
      const cardCount = Math.min(cards.length, 3);
      const gap = 0.22;
      const totalW = 9.0;
      const cW = (totalW - gap * (cardCount - 1)) / cardCount;

      cards.slice(0, cardCount).forEach((card, cIdx) => {
        const px = 0.5 + cIdx * (cW + gap);
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x: px, y: contentY, w: cW, h: contentH,
          fill: { color: CARD }, line: { color: BDR, width: 1 }, rectRadius: 0.10
        });
        slide.addShape(pptx.shapes.RECTANGLE, {
          x: px, y: contentY, w: cW, h: 0.06,
          fill: { color: cIdx === 0 ? ACC : ACC2 }
        });
        slide.addText(cleanTextForPptx(card.card_title || `Section ${cIdx + 1}`, 45), {
          x: px + 0.2, y: contentY + 0.18, w: cW - 0.4, h: 0.5,
          fontSize: 14, bold: true, color: TXT, fontFace: FT
        });
        const bText = (card.points || []).slice(0, 6).map(pt => ({
          text: cleanTextForPptx(String(pt), 120),
          options: { bullet: true, color: TXT, fontSize: 10.5 }
        }));
        slide.addText(bText as any, {
          x: px + 0.2, y: contentY + 0.78, w: cW - 0.4, h: contentH - 0.9,
          fontFace: FB, color: TXT, paraSpaceAfter: 7
        });
      });
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
