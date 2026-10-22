import OpenAI from 'openai';
import type { ILLMProvider, ChatMessage, CompletionOptions, ModelCompletionResult } from '../types.js';
import { withRetryAndTimeout } from '../../core/utils/retry.js';

export class GroqProvider implements ILLMProvider {
  public readonly name = 'groq';
  public readonly defaultModel: string;
  public readonly isLocal = false;
  private client: OpenAI | null = null;
  private apiKey: string | undefined;
  private activeModelsCache: string[] | null = null;
  private telemetry = {
    totalCalls: 0,
    httpStatus: 200,
    count429: 0,
    retries: 0,
    tokensPerCall: [] as Array<{ promptTokens: number; completionTokens: number; totalTokens: number }>,
  };

  constructor(options?: { apiKey?: string; defaultModel?: string }) {
    this.apiKey = options?.apiKey || process.env.GROQ_API_KEY;
    this.defaultModel = options?.defaultModel || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    if (this.apiKey) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    }
  }

  public getTelemetry() {
    return { ...this.telemetry };
  }

  public async getListedModels(): Promise<string[]> {
    if (this.activeModelsCache && this.activeModelsCache.length > 0) {
      return this.activeModelsCache;
    }
    if (!this.client) return [];
    try {
      const resp = await this.client.models.list();
      this.activeModelsCache = resp.data.map((m: any) => m.id);
      return this.activeModelsCache || [];
    } catch (err: any) {
      console.warn(`[GroqProvider] Failed to list models at runtime: ${err.message}`);
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<ModelCompletionResult> {
    if (!this.client) {
      throw new Error('GroqProvider is not configured: GROQ_API_KEY is missing');
    }

    // Query active models list at runtime
    const listedModels = await this.getListedModels();
    
    // Choose model prioritizing requested option, defaultModel, or first listed model
    let chosenModel = options?.model || this.defaultModel;
    if (listedModels.length > 0 && !listedModels.includes(chosenModel)) {
      // Find suitable text generation model in listed models
      const textModels = listedModels.filter(m => !m.includes('whisper') && !m.includes('guard'));
      chosenModel = textModels[0] || listedModels[0];
    }

    const fallbackModels = [
      chosenModel,
      ...(listedModels.length > 0 ? listedModels.filter(m => !m.includes('whisper') && !m.includes('guard')) : ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b']),
    ];

    let lastError: Error | null = null;
    let callRetries = 0;

    for (const modelName of Array.from(new Set(fallbackModels))) {
      try {
        const result = await withRetryAndTimeout(
          async (signal) => {
            const maxTokens = modelName.includes('qwen')
              ? Math.min(options?.maxTokens ?? 950, 950)
              : (options?.maxTokens ?? 2000);

            const reqBody: any = {
              model: modelName,
              messages,
              temperature: options?.temperature ?? 0.3,
              max_tokens: maxTokens,
              ...(options?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
            };

            if (modelName.startsWith('openai/')) {
              reqBody.reasoning_effort = 'low';
            }

            try {
              const response = await this.client!.chat.completions.create(reqBody, { signal });
              const content = response.choices[0]?.message?.content || '';
              const usage = {
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0,
              };

              this.telemetry.totalCalls++;
              this.telemetry.httpStatus = 200;
              this.telemetry.tokensPerCall.push(usage);

              return {
                content,
                model: modelName,
                provider: this.name,
                usage,
              };
            } catch (err: any) {
              if (err.status === 429 || err.message?.includes('429') || err.message?.includes('Rate limit')) {
                this.telemetry.count429++;
                this.telemetry.httpStatus = 429;
              }
              callRetries++;
              this.telemetry.retries++;
              throw err;
            }
          },
          {
            name: `Groq (${modelName})`,
            timeoutMs: 60000,
            retries: 2,
            initialDelayMs: 300,
            backoffFactor: 2,
            shouldRetry: (err) => !err.message?.includes('tokens per day') && !err.message?.includes('TPD'),
          }
        );

        return result;
      } catch (err: any) {
        lastError = err;
        console.warn(`[GroqProvider] Model ${modelName} attempt failed: ${err.message}. Trying next model...`);
      }
    }

    throw lastError || new Error('All Groq models failed');
  }
}
