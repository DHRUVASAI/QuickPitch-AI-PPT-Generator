import fs from 'fs';
import path from 'path';
import { getModelClient } from '../models/index.js';
import type { ChatMessage } from '../models/types.js';

async function testClaimVerification() {
  const client = getModelClient();
  const deckPath = path.resolve('scratch/round38_hindi_deck.json');
  const deck = JSON.parse(fs.readFileSync(deckPath, 'utf-8'));

  // Collect text from chunks 1, 2, 3
  const evidenceChunks = [
    deck.slides[0].bullets[0].citedChunkText,
    deck.slides[1].bullets[0].citedChunkText,
    deck.slides[2].bullets[0].citedChunkText,
  ].join('\n\n');

  const testBullets = [
    "Robots can solve problems using input from sensors",
    "more versatile AI like Alexa can perform multiple tasks",
    "Robots using input from a plank to cross a river they cannot swim across",
  ];

  for (const bullet of testBullets) {
    console.log(`\n========================================`);
    console.log(`Testing bullet: "${bullet}"`);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a strict, forensic factual grounding verifier.
Given a slide bullet point and the source evidence text from a video transcript, perform two tasks:
1. Split the bullet point into 1 to 4 atomic factual claims.
2. For each atomic claim, locate an EXACT verbatim quote from the evidence text that directly and fully supports the claim. If the claim is not directly supported, is contradicted, or adds any detail (such as a specific noun, tool, sensor, number, or adjective) not found in the evidence text, output "NONE".

Return a valid JSON array of objects with no other text, matching this structure:
[
  {
    "claim": "Atomic claim statement",
    "quote": "Exact verbatim quote from evidence text, or NONE"
  }
]
CRITICAL RULES:
- The quote MUST be an exact copy-paste substring from the evidence text (English or Hindi source text).
- Do not paraphrase, alter, or synthesize the quote.
- If ANY part of the claim is not explicitly in the evidence text, you MUST return "NONE".`,
      },
      {
        role: 'user',
        content: `EVIDENCE TEXT:\n"""\n${evidenceChunks}\n"""\n\nBULLET POINT TO VERIFY:\n"${bullet}"\n\nJSON Output:`,
      },
    ];

    const resp = await client.complete(messages, {
      temperature: 0.0,
      maxTokens: 300,
    });

    console.log(`Raw response:`, resp.content);

    let parsed: any[] = [];
    try {
      const match = resp.content.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    } catch (e: any) {
      console.error('Failed to parse JSON:', e.message);
    }

    const failedClaims: string[] = [];
    const verifiedQuotes: string[] = [];

    for (const item of parsed) {
      const q = (item.quote || '').trim().replace(/^["']|["']$/g, '');
      const claim = item.claim;

      if (!q || q.toUpperCase() === 'NONE' || q.length < 3) {
        failedClaims.push(`${claim} (quote: NONE)`);
      } else {
        const inEvidence = evidenceChunks.toLowerCase().includes(q.toLowerCase());
        if (inEvidence) {
          verifiedQuotes.push(`${claim} -> "${q}"`);
        } else {
          failedClaims.push(`${claim} (quote not in text: "${q}")`);
        }
      }
    }

    const isPassed = parsed.length > 0 && failedClaims.length === 0;
    console.log(`Verdict: ${isPassed ? 'SUPPORTED' : 'NO SUPPORT'}`);
    console.log(`Verified Quotes:`, verifiedQuotes);
    console.log(`Failed Claims:`, failedClaims);
  }
}

testClaimVerification().catch(console.error);
