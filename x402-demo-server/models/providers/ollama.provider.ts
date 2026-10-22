import type { ILLMProvider, ChatMessage, CompletionOptions, ModelCompletionResult } from '../types.js';
import { withRetryAndTimeout } from '../../core/utils/retry.js';

export class OllamaProvider implements ILLMProvider {
  public readonly name = 'ollama';
  public readonly defaultModel: string;
  public readonly isLocal = true;
  private baseUrl: string;
  private probeTimeoutMs: number;
  private genTimeoutMs: number;
  private keepAlive: string;
  private numCtx: number;

  constructor(options?: {
    baseUrl?: string;
    defaultModel?: string;
    probeTimeoutMs?: number;
    genTimeoutMs?: number;
    keepAlive?: string;
    numCtx?: number;
  }) {
    this.baseUrl = (options?.baseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/v1\/?$/, '');
    this.defaultModel = options?.defaultModel || process.env.OLLAMA_MODEL || 'qwen2.5:7b';
    this.probeTimeoutMs = options?.probeTimeoutMs ?? parseInt(process.env.OLLAMA_PROBE_TIMEOUT_MS || '2000', 10);
    this.genTimeoutMs = options?.genTimeoutMs ?? parseInt(process.env.OLLAMA_GEN_TIMEOUT_MS || '90000', 10);
    this.keepAlive = options?.keepAlive || process.env.OLLAMA_KEEP_ALIVE || '30m';
    this.numCtx = options?.numCtx ?? parseInt(process.env.OLLAMA_NUM_CTX || '8192', 10);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(this.probeTimeoutMs),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<ModelCompletionResult> {
    const modelToUse = options?.model || this.defaultModel;

    return withRetryAndTimeout(
      async (signal) => {
        const body: Record<string, any> = {
          model: modelToUse,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          stream: false,
          keep_alive: this.keepAlive,
          options: {
            num_ctx: this.numCtx,
            temperature: options?.temperature ?? 0.3,
            ...(options?.maxTokens ? { num_predict: options.maxTokens } : {}),
          },
        };

        if (options?.jsonMode) {
          body.format = 'json';
        }

        const resp = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal,
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          throw new Error(`Ollama HTTP ${resp.status}: ${errText || resp.statusText}`);
        }

        const data: any = await resp.json();
        const content = data.message?.content || '';

        return {
          content,
          model: modelToUse,
          provider: this.name,
          usage: {
            promptTokens: data.prompt_eval_count,
            completionTokens: data.eval_count,
            totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
          },
        };
      },
      {
        name: `Ollama (${modelToUse})`,
        timeoutMs: this.genTimeoutMs,
        retries: 1,
        initialDelayMs: 400,
      }
    );
  }
}
