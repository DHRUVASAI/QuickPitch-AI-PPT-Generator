/**
 * Run surviving new controls through Modes A, B, C, D
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeEvidence } from './evidence-helper.js';
import { gradeBulletAgainstSource, extractVerifiableEntities, entityMatchesSource } from '../core/synthesis/bullet-verifier.js';
import type { ChunkWithTime } from '../core/transcript/timestamp-utils.js';
import { normalizeDevanagariDigits } from '../core/transcript/chunk-translator.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const serverDir = path.resolve(__dirname, '..');

const whisperData = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/qzAHXO_large_v3_translate.json'), 'utf-8'));
const translatedUnits = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/qzAHXO_step3_deduped_translated.json'), 'utf-8'));
const hindiCues = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/qzAHXO_parsed_vtt.json'), 'utf-8'));

const rawWhisperText = whisperData.segments.map((s: any) => s.text).join(' ');
const rawHindiText = hindiCues.map((c: any) => c.text).join(' ');
const rawEnglishTranslation = translatedUnits.map((u: any) => u.translatedText || '').join(' ');

const fullVideoChunk: ChunkWithTime & { originalText?: string } = {
  index: 1,
  startSec: 0,
  endSec: 327.9,
  timestamps: '00:00 - 05:28',
  text: rawEnglishTranslation,
  originalText: rawHindiText,
};

const survivingPositives = [
  "Kurzweil predicts robots as smart as humans by 2045.",
  "Elon Musk predicts AI implants will enhance the human mind and body.",
  "The video asks viewers a quiz question in the comments.",
  "Machine learning is a technique for achieving AI.",
  "Strong AI is described as self-aware and able to develop emotions."
];

const survivingNegatives = [
  "The speaker explains how GPUs accelerate neural network training.",
  "The video says AI will replace all doctors by 2030.",
  "The speaker names OpenAI as the leader in generative AI.",
  "The video explains the Turing test."
];

const droppedControl = {
  bullet: "The speaker says Alexa is an example of strong AI.",
  reason: "Failed presence/absence pre-check (keyword 'strong ai' is present in corpus)"
};

const COMMON_STOPWORDS = new Set([
  'the','this','these','that','with','from','for','and','key','core','action',
  'impact','strategic','overview','pillar','section','high','low','each','our',
  'all','slide','features','benefits','role','system','systems','using','used',
  'their','there','when','what','where','which','why','how','today','now','then',
  'one','two','three','four','first','second','third','fourth','next','last',
  'example','examples','in','on','at','by','to','as','or','an','a','it','its'
]);

async function gradeModeA(bullet: string) {
  return (await gradeBulletAgainstSource(bullet, fullVideoChunk, undefined, rawWhisperText)).grade;
}

function gradeModeD(bullet: string) {
  const { numbers, entities } = extractVerifiableEntities(bullet);
  const candidateTerms = [...numbers, ...entities];
  const combined = ((fullVideoChunk.text || '') + ' ' + (fullVideoChunk.originalText || '')).toLowerCase();
  const normCombined = normalizeDevanagariDigits(combined);
  if (candidateTerms.length === 0) {
    const words = bullet.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !COMMON_STOPWORDS.has(w));
    const matched = words.filter(w => normCombined.includes(w));
    return (words.length === 0 || matched.length / words.length >= 0.4) ? 'SUPPORTED' : 'NO SUPPORT';
  }
  const foundAll = candidateTerms.every(term =>
    normCombined.includes(term.toLowerCase()) ||
    entityMatchesSource(term, normCombined)
  );
  return foundAll ? 'SUPPORTED' : 'NO SUPPORT';
}

async function main() {
  const results: any = {};
  for (const [modeId, modeLabel] of [
    ['A', 'Heuristic only (no LLM)'],
    ['B', 'LLM entailment only (UNVERIFIED - no live model)'],
    ['C', 'Both heuristic + LLM (production; LLM=none here)'],
    ['D', 'Evidence-bound (chunk_id + exact term match)'],
  ] as const) {
    const posRes = [];
    for (const b of survivingPositives) {
      let grade = 'UNVERIFIED';
      if (modeId === 'A' || modeId === 'C') grade = await gradeModeA(b);
      else if (modeId === 'D') grade = gradeModeD(b);
      posRes.push({ bullet: b, grade });
    }
    const negRes = [];
    for (const b of survivingNegatives) {
      let grade = 'UNVERIFIED';
      if (modeId === 'A' || modeId === 'C') grade = await gradeModeA(b);
      else if (modeId === 'D') grade = gradeModeD(b);
      negRes.push({ bullet: b, grade });
    }
    const posSupported = posRes.filter(r => r.grade === 'SUPPORTED').length;
    const posFalseReject = posRes.filter(r => r.grade === 'NO SUPPORT').length;
    const negSupported = negRes.filter(r => r.grade === 'SUPPORTED').length;
    const negNoSupport = negRes.filter(r => r.grade === 'NO SUPPORT').length;
    const negFalseAccept = negSupported;
    results[modeId] = {
      label: modeLabel,
      positives: {
        total: survivingPositives.length,
        SUPPORTED: posSupported,
        PARTIAL: posRes.filter(r => r.grade === 'PARTIAL').length,
        NO_SUPPORT: posFalseReject,
        UNVERIFIED: posRes.filter(r => r.grade === 'UNVERIFIED').length,
        falseReject: posFalseReject,
        flagRate: `${((survivingPositives.length - posSupported)/survivingPositives.length * 100).toFixed(1)}%`,
        bullets: posRes
      },
      negatives: {
        total: survivingNegatives.length,
        SUPPORTED: negSupported,
        PARTIAL: negRes.filter(r => r.grade === 'PARTIAL').length,
        NO_SUPPORT: negNoSupport,
        UNVERIFIED: negRes.filter(r => r.grade === 'UNVERIFIED').length,
        falseAccept: negFalseAccept,
        flagRate: `${((survivingNegatives.length - negSupported)/survivingNegatives.length * 100).toFixed(1)}%`,
        bullets: negRes
      }
    };
  }

  writeEvidence('round391_part18_item1_new_controls_modes.json', {
    description: 'Round 3.9 Part 1.8 Item 1: 10 new controls evaluated across modes A-D after dropping failed pre-check control',
    droppedControl,
    results
  }, [
    'scratch/qzAHXO_step3_deduped_translated.json',
    'scratch/qzAHXO_large_v3_translate.json',
    'scratch/qzAHXO_parsed_vtt.json',
  ]);

  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
