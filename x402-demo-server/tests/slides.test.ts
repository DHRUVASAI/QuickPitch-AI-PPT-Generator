import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateSlideDeck, type SlideDeck } from '../core/schemas/slide.schema.js';
import { selectTheme } from '../core/slides/themes.js';
import { compilePptx } from '../core/slides/pptx-compiler.js';

describe('Core Stage 3: Slide Deck Engine & Compilation', () => {
  const dummyDeck: SlideDeck = {
    theme: 'cyber-blue',
    detailLevel: 'balanced',
    slides: [
      {
        title: 'System Architecture',
        subtitle: 'Key components and interactions',
        category: 'ARCHITECTURE',
        layout_type: 'split_cards',
        cards: [
          { card_title: 'Ingestion Layer', points: ['High throughput', 'Stream parsing'] },
          { card_title: 'Storage Layer', points: ['Persistent disk', 'Fast index'] },
        ],
      },
      {
        title: 'Roadmap & Future Work',
        subtitle: 'Milestones and delivery plan',
        category: 'EXECUTION',
        layout_type: 'three_columns',
        cards: [
          { card_title: 'Phase 1', points: ['Core engine rollout'] },
          { card_title: 'Phase 2', points: ['Distributed scaling'] },
          { card_title: 'Phase 3', points: ['Global edge replication'] },
        ],
      },
    ],
  };

  it('should validate and enforce SlideDeck schema', () => {
    const validated = validateSlideDeck(dummyDeck);
    assert.strictEqual(validated.theme, 'cyber-blue');
    assert.strictEqual(validated.slides.length, 2);
    assert.strictEqual(validated.slides[0].title, 'System Architecture');
  });

  it('should select theme based on keywords or requested name', () => {
    assert.strictEqual(selectTheme('monochrome-dark').name, 'Monochrome Dark');
    assert.strictEqual(selectTheme(undefined, 'Python software code').name, 'Cyber Blue');
    assert.strictEqual(selectTheme(undefined, 'Quarterly financial earnings report').name, 'Emerald Growth');
  });

  it('should compile a validated SlideDeck into a real PPTX buffer', async () => {
    const result = await compilePptx(dummyDeck, 'neon-matrix');

    assert.ok(result.buffer instanceof Buffer);
    assert.ok(result.buffer.length > 5000); // Valid PPTX zip package is at least several KB
    assert.strictEqual(result.slideCount, 3); // 1 Cover + 2 Content Slides
    assert.strictEqual(result.theme.name, 'Neon Matrix');
    assert.ok(result.fileName.includes('Neon_Matrix'));
  });
});
