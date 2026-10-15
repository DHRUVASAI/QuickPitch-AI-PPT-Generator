import OpenAI from 'openai';
import type { ILLMProvider, ChatMessage, CompletionOptions, ModelCompletionResult } from '../types.js';

export class OllamaProvider implements ILLMProvider {
  public readonly name = 'ollama';
  public readonly defaultModel: string;
  private client: OpenAI;
  private baseUrl: string;

  constructor(options?: { baseUrl?: string; defaultModel?: string }) {
    this.baseUrl = options?.baseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1';
    this.defaultModel = options?.defaultModel || process.env.OLLAMA_MODEL || 'qwen2.5:7b';
    this.client = new OpenAI({
      baseURL: this.baseUrl,
      apiKey: 'ollama', // Dummy key for local Ollama
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      const rootUrl = this.baseUrl.replace(/\/v1\/?$/, '');
      const resp = await fetch(`${rootUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<ModelCompletionResult> {
    const modelToUse = options?.model || this.defaultModel;
    const response = await this.client.chat.completions.create({
      model: modelToUse,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 2000,
      ...(options?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    });

    const content = response.choices[0]?.message?.content || '';
    return {
      content,
      model: modelToUse,
      provider: this.name,
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
    };
  }
}
