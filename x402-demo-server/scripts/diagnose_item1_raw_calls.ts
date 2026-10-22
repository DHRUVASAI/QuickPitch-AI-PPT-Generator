import fs from 'node:fs';
import path from 'node:path';
import { getModelClient } from '../models/index.js';
import type { ChatMessage } from '../models/types.js';

const serverDir = path.resolve(__dirname, '..');

const translatedUnits = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/qzAHXO_step3_deduped_translated.json'), 'utf-8'));
const hindiCues = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/qzAHXO_parsed_vtt.json'), 'utf-8'));
const rawHindiText = hindiCues.map((c: any) => c.text).join(' ');
const rawEnglishTranslation = translatedUnits.map((u: any) => u.translatedText || '').join(' ');

const passageForLlm = `Source text (Original):\n"${rawHindiText}"\n\nSource text (English translation):\n"${rawEnglishTranslation}"`;

const bullets = [
  { type: 'supported', text: 'Weak AI performs only one kind of task.' },
  { type: 'contradicted', text: 'The speaker says Alexa is an example of strong AI.' },
  { type: 'unrelated', text: 'The speaker explains how blockchain secures AI models.' }
];

async function main() {
  const client = getModelClient();
  const results = [];

  for (const b of bullets) {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a strict cross-lingual factual grounding checker. The source passage may be in Hindi or English, and the claim is in English. Answer YES if the claim is directly supported, conveyed, or stated in the passage (even across languages). Answer NO if the claim is unsupported, contradicted, fabricated, or not mentioned.',
      },
      {
        role: 'user',
        content: `Source passage:\n"${passageForLlm}"\n\nClaim:\n"${b.text}"\n\nIs this claim stated or conveyed in this passage? Answer YES or NO:`,
      },
    ];

    const rawRequest = {
      provider: client.getPrimaryProviderName(), // 'ollama' in default config
      model: 'qwen2.5:7b',
      max_tokens: 500,
      reasoning_settings: {
        temperature: 0.0,
        keep_alive: '30m',
        num_ctx: 8192
      },
      cloud_toggle_on: false
    };

    const start = Date.now();
    try {
      const resp = await client.complete(messages, {
        temperature: 0.0,
        maxTokens: 500,
        allowCloudFallback: false
      });
      const durationMs = Date.now() - start;

      results.push({
        bullet_type: b.type,
        bullet_text: b.text,
        raw_request: rawRequest,
        raw_response: {
          finish_reason: 'stop',
          content: resp.content,
          provider_used: resp.provider,
          model_used: resp.model,
          usage: resp.usage,
          duration_ms: durationMs
        }
      });
    } catch (err: any) {
      results.push({
        bullet_type: b.type,
        bullet_text: b.text,
        raw_request: rawRequest,
        raw_response: {
          error: err.message
        }
      });
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
