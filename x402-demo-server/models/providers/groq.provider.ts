import OpenAI from 'openai';
import type { ILLMProvider, ChatMessage, CompletionOptions, ModelCompletionResult } from '../types.js';
import { withRetryAndTimeout } from '../../core/utils/retry.js';

export class GroqProvider implements ILLMProvider {
  public readonly name = 'groq';
  public readonly defaultModel: string;
  public readonly isLocal = false;
  private client: OpenAI | null = null;
  private apiKey: string | undefined;

  constructor(options?: { apiKey?: string; defaultModel?: string }) {
    this.apiKey = options?.apiKey || process.env.GROQ_API_KEY;
    this.defaultModel = options?.defaultModel || 'llama-3.3-70b-versatile';
    if (this.apiKey) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<ModelCompletionResult> {
    if (!this.client) {
      throw new Error('GroqProvider is not configured: GROQ_API_KEY is missing');
    }

    const fallbackModels = [
      options?.model || this.defaultModel,
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ];

    let lastError: Error | null = null;
    for (const modelName of Array.from(new Set(fallbackModels))) {
      try {
        return await withRetryAndTimeout(
          async (signal) => {
            const response = await this.client!.chat.completions.create(
              {
                model: modelName,
                messages,
                temperature: options?.temperature ?? 0.3,
                max_tokens: options?.maxTokens ?? 2000,
                ...(options?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
              },
              { signal }
            );

            const content = response.choices[0]?.message?.content || '';
            return {
              content,
              model: modelName,
              provider: this.name,
              usage: {
                promptTokens: response.usage?.prompt_tokens,
                completionTokens: response.usage?.completion_tokens,
                totalTokens: response.usage?.total_tokens,
              },
            };
          },
          {
            name: `Groq (${modelName})`,
            timeoutMs: 10000,
            retries: 2,
            initialDelayMs: 300,
            backoffFactor: 2,
          }
        );
      } catch (err: any) {
        lastError = err;
        console.warn(`[GroqProvider] Model ${modelName} attempt failed: ${err.message}. Trying next model...`);
      }
    }

    throw lastError || new Error('All Groq models failed');
  }
}
