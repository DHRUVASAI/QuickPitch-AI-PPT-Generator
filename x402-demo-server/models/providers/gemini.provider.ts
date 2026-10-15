import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ILLMProvider, ChatMessage, CompletionOptions, ModelCompletionResult } from '../types.js';
import { withRetryAndTimeout } from '../../core/utils/retry.js';

export class GeminiProvider implements ILLMProvider {
  public readonly name = 'gemini';
  public readonly defaultModel: string;
  public readonly isLocal = false;
  private client: GoogleGenerativeAI | null = null;
  private apiKey: string | undefined;

  constructor(options?: { apiKey?: string; defaultModel?: string }) {
    this.apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
    this.defaultModel = options?.defaultModel || 'gemini-1.5-flash';
    if (this.apiKey) {
      this.client = new GoogleGenerativeAI(this.apiKey);
    }
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<ModelCompletionResult> {
    if (!this.client) {
      throw new Error('GeminiProvider is not configured: GEMINI_API_KEY is missing');
    }

    const modelToUse = options?.model || this.defaultModel;
    const model = this.client.getGenerativeModel({ model: modelToUse });

    // Format messages for Gemini API
    const systemMsg = messages.find((m) => m.role === 'system');
    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const prompt = systemMsg
      ? `${systemMsg.content}\n\n${conversation}`
      : conversation;

    return withRetryAndTimeout(
      async () => {
        const result = await model.generateContent(prompt);
        const content = result.response.text();
        return {
          content,
          model: modelToUse,
          provider: this.name,
        };
      },
      {
        name: `Gemini (${modelToUse})`,
        timeoutMs: 12000,
        retries: 2,
        initialDelayMs: 400,
      }
    );
  }
}
