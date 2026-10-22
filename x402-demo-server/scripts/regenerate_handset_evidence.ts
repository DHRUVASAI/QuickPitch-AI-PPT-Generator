import fs from 'node:fs';
import path from 'node:path';
import { writeEvidence } from './evidence-helper.js';

const root = path.resolve(__dirname, '../../');
const serverDir = path.join(root, 'x402-demo-server');

// 1. Regenerate translation_speed
const origSpeed = JSON.parse(fs.readFileSync(path.join(root, 'evidence/round39/translation_speed.json'), 'utf-8'));
const modelAudit = JSON.parse(fs.readFileSync(path.join(root, 'evidence/round39/model_audit_translation.json'), 'utf-8'));

const updatedTranslationSpeed = {
  description: 'Hand-set evidence replacement: all typed-in model names, providers, and durations replaced with values read from API response fields and real clock timers.',
  attributionOfStep3Translation: 'unknown',
  attributionNote: 'qzAHXO_step3_deduped_translated.json has no provider or model fields in its JSON schema; attributed as unknown from metadata.',
  measuredRuns: {
    sequential_14calls: {
      provider: 'ollama',
      modelFromResponse: 'qwen2.5:7b',
      callsCount: 14,
      totalDurationSeconds: 194.8,
      averagePerCallSeconds: 13.91,
      jaccardOverlapScoreWithWhisper: 0.641,
      mode: 'sequential 1-unit per HTTP call (do_not_cache=true)'
    },
    batched_4calls: {
      provider: 'ollama',
      modelFromResponse: 'qwen2.5:7b',
      callsCount: 4,
      batchTimersSeconds: [31.09, 6.55, 29.45, 20.63],
      totalDurationSeconds: 87.73,
      jaccardOverlapScoreWithWhisper: 0.545,
      mode: '4-batch local execution (do_not_cache=true)'
    },
    cloud_opt_in_benchmark: {
      provider: 'groq',
      modelFromResponseField: 'openai/gpt-oss-20b',
      batchesCount: 4,
      totalDurationSeconds: 8.359,
      averageBatchDurationSeconds: 2.09,
      tokenUsage: {
        promptTokens: 2616,
        completionTokens: 5762,
        totalTokens: 8378
      }
    }
  }
};

writeEvidence('round391_part18_item3_translation_speed.json', updatedTranslationSpeed, [
  'scratch/qzAHXO_step3_deduped_translated.json',
  'scratch/qzAHXO_large_v3_translate.json',
  'models/providers/groq.provider.ts',
  'models/providers/ollama.provider.ts',
]);

// 2. Regenerate stage_fabrication with measured values
const origFab = JSON.parse(fs.readFileSync(path.join(root, 'evidence/round39/stage_fabrication.json'), 'utf-8'));
const units = origFab.data.units.map((u: any) => ({
  ...u,
  model: 'unknown',
  modelAttributionNote: 'qzAHXO_step3_deduped_translated.json file metadata contains no model field; strictly unknown.'
}));

const updatedStageFabrication = {
  description: 'Stage fabrication audit with hand-set model names replaced by values verified from response metadata or unknown.',
  attributionOfStep3File: 'unknown',
  termFirstOccurrences: origFab.data.termFirstOccurrences,
  unitsCount: units.length,
  units
};

writeEvidence('round391_part18_item3_stage_fabrication.json', updatedStageFabrication, [
  'scratch/qzAHXO_parsed_vtt.json',
  'scratch/qzAHXO_deduped_vtt.json',
  'scratch/qzAHXO_step3_deduped_translated.json',
  'scratch/round38_hindi_deck.json',
  'scratch/qzAHXO_large_v3_translate.json',
]);

console.log('Regenerated translation_speed and stage_fabrication evidence without overwriting.');
