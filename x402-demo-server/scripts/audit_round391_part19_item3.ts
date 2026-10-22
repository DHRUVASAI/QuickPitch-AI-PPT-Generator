import fs from 'node:fs';
import path from 'node:path';
import { getModelClient } from '../models/index.js';
import type { ChatMessage } from '../models/types.js';
import { extractVerifiableEntities, entityMatchesSource } from '../core/synthesis/bullet-verifier.js';
import type { ChunkWithTime } from '../core/transcript/timestamp-utils.js';
import { normalizeDevanagariDigits } from '../core/transcript/chunk-translator.js';

const serverDir = path.resolve(__dirname, '..');
const rootEvidenceDir = path.resolve(serverDir, '..', 'evidence', 'round39');

const closestData = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/closest_lines_fresh_controls.json'), 'utf-8'));
const translatedUnits = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/qzAHXO_step3_deduped_translated.json'), 'utf-8'));
const hindiCues = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/qzAHXO_parsed_vtt.json'), 'utf-8'));

const rawHindiText = hindiCues.map((c: any) => c.text).join(' ');
const rawEnglishTranslation = translatedUnits.map((u: any) => u.translatedText || '').join(' ');
const fullVideoText = `${rawHindiText}\n\n${rawEnglishTranslation}`;

const fullVideoChunk: ChunkWithTime = {
  index: 1,
  startSec: 0,
  endSec: 327.889,
  timestamps: '00:00 - 05:27',
  text: rawEnglishTranslation,
};

const client = getModelClient();

async function runLlmCheck(bullet: string, passageText: string, provider: 'ollama' | 'groq'): Promise<{ answer: 'YES' | 'NO'; raw: string }> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a strict cross-lingual factual grounding checker. The source passage may be in Hindi or English, and the claim is in English. Answer strictly YES if the claim is directly supported, conveyed, or stated in the passage (even across languages). Answer strictly NO if the claim is unsupported, contradicted, fabricated, or not mentioned. Return ONLY "YES" or "NO".',
    },
    {
      role: 'user',
      content: `Source passage:\n"${passageText}"\n\nClaim:\n"${bullet}"\n\nIs this claim stated or conveyed in this passage? Answer strictly YES or NO:`,
    },
  ];

  try {
    const resp = await client.complete(messages, {
      temperature: 0.0,
      maxTokens: 5,
      preferredProvider: provider,
      allowCloudFallback: provider === 'groq',
    });
    const content = resp.content.trim().toUpperCase();
    const isYes = content.startsWith('YES');
    return { answer: isYes ? 'YES' : 'NO', raw: resp.content };
  } catch (err: any) {
    return { answer: 'NO', raw: `ERROR: ${err.message}` };
  }
}

function runHeuristicCheck(bullet: string): { grade: 'SUPPORTED' | 'PARTIAL' | 'NO SUPPORT'; flaggedTerms: string[] } {
  const normSource = normalizeDevanagariDigits(fullVideoText);
  const normSourceLower = normSource.toLowerCase();

  const { numbers, entities } = extractVerifiableEntities(bullet);
  const flaggedTerms: string[] = [];

  for (const num of numbers) {
    if (!normSource.includes(num)) {
      flaggedTerms.push(`Number "${num}"`);
    }
  }

  for (const entity of entities) {
    if (!entityMatchesSource(entity, normSourceLower)) {
      flaggedTerms.push(`Entity/Product "${entity}"`);
    }
  }

  if (flaggedTerms.length === 0) {
    return { grade: 'SUPPORTED', flaggedTerms: [] };
  } else if (flaggedTerms.length <= 1) {
    return { grade: 'PARTIAL', flaggedTerms };
  } else {
    return { grade: 'NO SUPPORT', flaggedTerms };
  }
}

function runEvidenceBoundCheck(bullet: string): { grade: 'SUPPORTED' | 'NO SUPPORT'; citedChunk: number; quote: string; quoteFound: boolean } {
  // Mode D: Model/Code supplies chunk id and exact quote
  // Search for the best matching phrase in translated units
  let bestQuote = '';
  let bestChunk = 1;
  let quoteFound = false;

  // Extract key n-grams
  const words = bullet.split(/\s+/).filter(w => w.length > 3);
  for (const unit of translatedUnits) {
    const text = unit.translatedText || '';
    for (let len = Math.min(5, words.length); len >= 3; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ');
        if (text.toLowerCase().includes(phrase.toLowerCase())) {
          bestQuote = phrase;
          bestChunk = unit.unitIndex;
          quoteFound = true;
          break;
        }
      }
      if (quoteFound) break;
    }
    if (quoteFound) break;
  }

  if (quoteFound && bestQuote.length > 10) {
    return { grade: 'SUPPORTED', citedChunk: bestChunk, quote: bestQuote, quoteFound: true };
  }
  return { grade: 'NO SUPPORT', citedChunk: 1, quote: bestQuote || 'NONE', quoteFound: false };
}

async function main() {
  console.log('=== RUNNING FRESH CONTROLS EVALUATION (ITEM 3) ===');
  
  const results: any[] = [];

  for (const item of closestData) {
    console.log(`\nEvaluating [${item.id}]: "${item.claim}" (Ground Truth: ${item.judgment})`);
    
    // Heuristic (Mode A)
    const heur = runHeuristicCheck(item.claim);

    // Construct matched chunk passage (original Hindi + translated English)
    const topUnitIdx = item.top3_en[0].unitIndex;
    const unit = translatedUnits.find((u: any) => u.unitIndex === topUnitIdx);
    const enText = unit?.translatedText || '';
    const hiText = unit?.rawUnits?.map((u: any) => u.text).join(' ') || item.top3_hi.map((h: any) => h.text).join(' ');
    const passage = `Source text (Original):\n"${hiText}"\n\nSource text (English translation):\n"${enText}"`;

    // LLM local (Ollama)
    console.log(`  -> Running Ollama judge (cloud off)...`);
    const llmLocal = await runLlmCheck(item.claim, passage, 'ollama');

    // LLM cloud (Groq)
    console.log(`  -> Running Groq judge (cloud on)...`);
    const llmCloud = await runLlmCheck(item.claim, passage, 'groq');

    // Mode D
    const modeD = runEvidenceBoundCheck(item.claim);

    // Mode C Local (Heuristic + Local LLM)
    const modeCLocalGrade = (heur.grade === 'SUPPORTED' && llmLocal.answer === 'YES') ? 'SUPPORTED' :
                            (heur.grade === 'PARTIAL' && llmLocal.answer === 'YES') ? 'PARTIAL' : 'NO SUPPORT';

    // Mode C Cloud (Heuristic + Cloud LLM)
    const modeCCloudGrade = (heur.grade === 'SUPPORTED' && llmCloud.answer === 'YES') ? 'SUPPORTED' :
                            (heur.grade === 'PARTIAL' && llmCloud.answer === 'YES') ? 'PARTIAL' : 'NO SUPPORT';

    const evalRecord = {
      id: item.id,
      claim: item.claim,
      group: item.id.startsWith('P') ? 'POSITIVE' : 'NEGATIVE',
      groundTruth: item.judgment,
      closestEnglish: item.top3_en,
      closestHindi: item.top3_hi,
      default_config_local: {
        modeA_heuristic: heur.grade,
        modeB_llm: llmLocal.answer === 'YES' ? 'SUPPORTED' : 'NO SUPPORT',
        modeB_raw: llmLocal.raw,
        modeC_both: modeCLocalGrade,
        modeD_evidence_bound: modeD.grade,
        modeD_quote: modeD.quote,
        modeD_chunk: modeD.citedChunk,
      },
      cloud_on: {
        modeA_heuristic: heur.grade,
        modeB_llm: llmCloud.answer === 'YES' ? 'SUPPORTED' : 'NO SUPPORT',
        modeB_raw: llmCloud.raw,
        modeC_both: modeCCloudGrade,
        modeD_evidence_bound: modeD.grade,
        modeD_quote: modeD.quote,
        modeD_chunk: modeD.citedChunk,
      }
    };

    results.push(evalRecord);
  }

  // Summary tallies
  function computeStats(records: any[], configKey: 'default_config_local' | 'cloud_on', modeKey: string) {
    const pos = records.filter(r => r.group === 'POSITIVE');
    const neg = records.filter(r => r.group === 'NEGATIVE');

    const posSupported = pos.filter(r => r[configKey][modeKey] === 'SUPPORTED').length;
    const posPartial = pos.filter(r => r[configKey][modeKey] === 'PARTIAL').length;
    const posNoSupport = pos.filter(r => r[configKey][modeKey] === 'NO SUPPORT').length;
    const posUnverified = pos.filter(r => r[configKey][modeKey] === 'UNVERIFIED').length;
    // False reject: positive item marked NO SUPPORT or UNVERIFIED
    const falseReject = posNoSupport + posUnverified;

    const negSupported = neg.filter(r => r[configKey][modeKey] === 'SUPPORTED').length;
    const negPartial = neg.filter(r => r[configKey][modeKey] === 'PARTIAL').length;
    const negNoSupport = neg.filter(r => r[configKey][modeKey] === 'NO SUPPORT').length;
    const negUnverified = neg.filter(r => r[configKey][modeKey] === 'UNVERIFIED').length;
    // False accept: negative item marked SUPPORTED
    const falseAccept = negSupported;

    return {
      positive: { supported: posSupported, partial: posPartial, noSupport: posNoSupport, unverified: posUnverified, falseReject, total: pos.length },
      negative: { supported: negSupported, partial: negPartial, noSupport: negNoSupport, unverified: negUnverified, falseAccept, total: neg.length },
    };
  }

  const summary = {
    default_config_local: {
      modeA: computeStats(results, 'default_config_local', 'modeA_heuristic'),
      modeB: computeStats(results, 'default_config_local', 'modeB_llm'),
      modeC: computeStats(results, 'default_config_local', 'modeC_both'),
      modeD: computeStats(results, 'default_config_local', 'modeD_evidence_bound'),
    },
    cloud_on: {
      modeA: computeStats(results, 'cloud_on', 'modeA_heuristic'),
      modeB: computeStats(results, 'cloud_on', 'modeB_llm'),
      modeC: computeStats(results, 'cloud_on', 'modeC_both'),
      modeD: computeStats(results, 'cloud_on', 'modeD_evidence_bound'),
    }
  };

  const finalOutput = {
    timestamp: new Date().toISOString(),
    item: 'Round 3.9 Part 1.9 Item 3 - Fresh Controls Audit',
    summary,
    controls: results,
  };

  const evidenceFilePath = path.join(rootEvidenceDir, 'round391_part19_item3_fresh_controls.json');
  fs.writeFileSync(evidenceFilePath, JSON.stringify(finalOutput, null, 2), 'utf-8');
  console.log(`\n✅ Evidence written to: ${evidenceFilePath}`);
  console.log('\n--- SUMMARY STATS ---');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error('Fatal error in item 3 evaluation:', err);
  process.exit(1);
});
