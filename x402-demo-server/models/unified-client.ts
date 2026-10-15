import type {
  ILLMProvider,
  ChatMessage,
  CompletionOptions,
  ModelCompletionResult,
} from './types.js';

export class UnifiedModelClient {
  private providers: Map<string, ILLMProvider> = new Map();
  private primaryProviderName: string = 'ollama';

  constructor(providers: ILLMProvider[] = []) {
    for (const provider of providers) {
      this.registerProvider(provider);
    }
    if (providers.length > 0) {
      this.primaryProviderName = providers[0].name;
    }
  }

  registerProvider(provider: ILLMProvider, makePrimary: boolean = false): void {
    this.providers.set(provider.name, provider);
    if (makePrimary || this.providers.size === 1) {
      this.primaryProviderName = provider.name;
    }
  }

  setPrimaryProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider "${name}" is not registered. Available: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    this.primaryProviderName = name;
  }

  getPrimaryProviderName(): string {
    return this.primaryProviderName;
  }

  getProvider(name: string): ILLMProvider | undefined {
    return this.providers.get(name);
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Execute chat completion using the primary provider, with automatic fallback
   * to any other registered and available providers if primary fails.
   */
  async complete(
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<ModelCompletionResult> {
    if (this.providers.size === 0) {
      throw new Error('No LLM providers are registered in UnifiedModelClient.');
    }

    // Determine priority list starting with primary provider
    const priorityList: ILLMProvider[] = [];
    const primary = this.providers.get(this.primaryProviderName);
    if (primary) priorityList.push(primary);

    for (const [name, provider] of this.providers.entries()) {
      if (name !== this.primaryProviderName) {
        priorityList.push(provider);
      }
    }

    let lastError: Error | null = null;

    for (const provider of priorityList) {
      try {
        const isAvail = await provider.isAvailable();
        if (!isAvail) {
          continue;
        }

        const result = await provider.complete(messages, options);
        if (result.content && result.content.trim().length > 0) {
          return result;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[UnifiedModelClient] Provider "${provider.name}" failed: ${err.message}. Trying next fallback...`);
      }
    }

    throw lastError || new Error('All registered LLM providers failed to complete the request.');
  }

  /**
   * Execute chat completion specifically with a chosen provider name
   */
  async completeWith(
    providerName: string,
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<ModelCompletionResult> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider "${providerName}" is not registered.`);
    }
    return provider.complete(messages, options);
  }
}
