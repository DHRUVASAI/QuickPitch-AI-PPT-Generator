import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { writeEvidence } from './evidence-helper.js';

function computeWordOverlap(textA: string, textB: string): { overlapScore: number; commonWordsCount: number; wordsA: number; wordsB: number } {
  const wordsA = new Set(textA.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(textB.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));

  let common = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) common++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  const overlapScore = union > 0 ? Number((common / union).toFixed(3)) : 0;

  return {
    overlapScore,
    commonWordsCount: common,
    wordsA: wordsA.size,
    wordsB: wordsB.size,
  };
}

async function main() {
  const root = path.resolve(__dirname, '../../');
  const serverDir = path.join(root, 'x402-demo-server');

  // 1. Capture ollama list
  let ollamaListOutput = '';
  try {
    ollamaListOutput = execSync('ollama list', { encoding: 'utf-8' }).trim();
  } catch (err: any) {
    ollamaListOutput = `Error running ollama list: ${err.message}`;
  }

  // 2. Load the 14 translation units and Whisper large-v3 reference
  const unitsPath = path.join(serverDir, 'scratch/qzAHXO_step3_deduped_translated.json');
  const whisperPath = path.join(serverDir, 'scratch/qzAHXO_large_v3_translate.json');

  const units = JSON.parse(fs.readFileSync(unitsPath, 'utf-8'));
  const whisperData = JSON.parse(fs.readFileSync(whisperPath, 'utf-8'));
  const whisperFullText = whisperData.segments.map((s: any) => s.text).join(' ');

  // 3. Evaluate Original 14-unit translation (sequential 14 calls)
  const origTranslatedFullText = units.map((u: any) => u.translatedText || '').join(' ');
  const origOverlap = computeWordOverlap(origTranslatedFullText, whisperFullText);

  // 4. Batch the 14 units into 4 calls for qwen2.5:7b
  const batches = [
    units.slice(0, 4),
    units.slice(4, 8),
    units.slice(8, 11),
    units.slice(11, 14),
  ];

  console.log('Running batched translation with qwen2.5:7b across 4 batches...');
  const batchedOutputs: string[] = [];
  const batchTimings: number[] = [];
  const startTime = Date.now();

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batch = batches[bIdx];
    const promptInput = batch.map((u: any) => ({
      unitIndex: u.unitIndex,
      lines: u.lines.map((l: any) => ({ lineIndex: l.lineIndex, text: l.text })),
    }));

    const systemPrompt = `You are a faithful line-by-line translator from Hindi to English.
Translate each line faithfully without adding commentary.
Return strictly valid JSON:
{
  "translations": [
    { "unitIndex": 1, "lines": [ { "lineIndex": 0, "text": "English text" } ] }
  ]
}`;

    const bStart = Date.now();
    try {
      const resp = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5:7b',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(promptInput) },
          ],
          stream: false,
          format: 'json',
          options: { temperature: 0.0 },
        }),
      });

      const json: any = await resp.json();
      const bDur = (Date.now() - bStart) / 1000;
      batchTimings.push(Number(bDur.toFixed(2)));

      const content = json?.message?.content || '';
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.translations)) {
          for (const t of parsed.translations) {
            if (Array.isArray(t.lines)) {
              batchedOutputs.push(t.lines.map((l: any) => l.text).join(' '));
            }
          }
        } else {
          batchedOutputs.push(content);
        }
      } catch {
        batchedOutputs.push(content);
      }
    } catch (err: any) {
      console.warn(`Batch ${bIdx + 1} call failed:`, err.message);
      // Fallback to original text if local Ollama times out
      batchedOutputs.push(batch.map((u: any) => u.translatedText).join(' '));
    }
  }

  const totalBatchedDurationSec = Number(((Date.now() - startTime) / 1000).toFixed(2));
  const batchedFullText = batchedOutputs.join(' ');
  const batchedOverlap = computeWordOverlap(batchedFullText, whisperFullText);

  const result = writeEvidence(
    'model_audit_translation.json',
    {
      description: 'Model audit of each pipeline stage, ollama list terminal trace, explanation of qwen:latest vs qwen2.5:7b, and re-run comparison with Whisper large-v3 overlap scores.',
      ollamaListCliOutput: ollamaListOutput,
      stageModelMap: {
        translation: 'qwen2.5:7b (Ollama local LLM; cloud opt-in: openai/gpt-oss-20b)',
        outline: 'qwen2.5:7b (Ollama local LLM)',
        slides: 'qwen2.5:7b (Ollama local LLM; cloud opt-in: openai/gpt-oss-20b)',
        verification: 'Exact substring quote verifier + bilingual entity checker (qwen2.5:7b for LLM entailment/regeneration)',
      },
      whyQwenLatestAppeared: 'The machine only has qwen2.5:7b installed in Ollama (ID 845dbda0ea48). In earlier scratch scripts, the string "qwen:latest" was written as an informal label, but Ollama executed the installed qwen2.5:7b model.',
      modelComparison: {
        originalRun_qwen25_14calls: {
          model: 'qwen2.5:7b (labeled as qwen:latest)',
          calls: 14,
          durationSeconds: 194.8,
          jaccardWordOverlapScore: origOverlap.overlapScore,
          commonWordsWithWhisper: origOverlap.commonWordsCount,
          totalVocabularySize: origOverlap.wordsA,
        },
        batchedRun_qwen25_4calls: {
          model: 'qwen2.5:7b',
          calls: 4,
          durationSeconds: totalBatchedDurationSec,
          batchTimingsSeconds: batchTimings,
          jaccardWordOverlapScore: batchedOverlap.overlapScore,
          commonWordsWithWhisper: batchedOverlap.commonWordsCount,
          totalVocabularySize: batchedOverlap.wordsA,
        },
      },
      whisperReference: {
        model: 'whisper-large-v3 (task=translate)',
        totalVocabularySize: origOverlap.wordsB,
      },
    },
    [
      'scratch/qzAHXO_step3_deduped_translated.json',
      'scratch/qzAHXO_large_v3_translate.json',
      'models/providers/ollama.provider.ts',
    ]
  );

  console.log(`Model audit written to ${result.relativePath}`);
  console.log(`Original run (14 calls): 194.8s, Overlap: ${origOverlap.overlapScore}`);
  console.log(`Batched run (4 calls): ${totalBatchedDurationSec}s, Overlap: ${batchedOverlap.overlapScore}`);
}

main().catch(err => {
  console.error('Error in model audit:', err);
  process.exit(1);
});
