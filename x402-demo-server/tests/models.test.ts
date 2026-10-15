import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UnifiedModelClient } from '../models/unified-client.js';
import type { ILLMProvider, ChatMessage, ModelCompletionResult } from '../models/types.js';

class MockProvider implements ILLMProvider {
  public callCount = 0;
  constructor(
    public readonly name: string,
    public readonly defaultModel: string = 'mock-model',
    private shouldFail: boolean = false,
    private mockResponse: string = 'Mock response'
  ) {}

  async isAvailable(): Promise<boolean> {
    return !this.shouldFail;
  }

  async complete(messages: ChatMessage[]): Promise<ModelCompletionResult> {
    this.callCount++;
    if (this.shouldFail) {
      throw new Error(`MockProvider ${this.name} simulated failure`);
    }
    return {
      content: this.mockResponse,
      model: this.defaultModel,
      provider: this.name,
    };
  }
}

describe('Model Access Layer: UnifiedModelClient', () => {
  it('should register and route requests to the primary provider', async () => {
    const mockOllama = new MockProvider('ollama', 'qwen2.5:7b', false, 'Answer from Qwen');
    const mockGroq = new MockProvider('groq', 'llama-3.3-70b', false, 'Answer from Groq');

    const client = new UnifiedModelClient([mockOllama, mockGroq]);

    assert.strictEqual(client.getPrimaryProviderName(), 'ollama');

    const res = await client.complete([{ role: 'user', content: 'Hello' }]);
    assert.strictEqual(res.provider, 'ollama');
    assert.strictEqual(res.content, 'Answer from Qwen');
    assert.strictEqual(mockOllama.callCount, 1);
    assert.strictEqual(mockGroq.callCount, 0);
  });

  it('should allow dynamically swapping the primary provider', async () => {
    const mockOllama = new MockProvider('ollama', 'qwen2.5:7b', false, 'Answer from Qwen');
    const mockGroq = new MockProvider('groq', 'llama-3.3-70b', false, 'Answer from Groq');

    const client = new UnifiedModelClient([mockOllama, mockGroq]);
    client.setPrimaryProvider('groq');

    assert.strictEqual(client.getPrimaryProviderName(), 'groq');

    const res = await client.complete([{ role: 'user', content: 'Hello' }]);
    assert.strictEqual(res.provider, 'groq');
    assert.strictEqual(res.content, 'Answer from Groq');
    assert.strictEqual(mockGroq.callCount, 1);
  });

  it('should automatically failover to secondary provider when primary fails', async () => {
    const brokenOllama = new MockProvider('ollama', 'qwen2.5:7b', true);
    const backupGroq = new MockProvider('groq', 'llama-3.3-70b', false, 'Fallback answer from Groq');

    const client = new UnifiedModelClient([brokenOllama, backupGroq]);

    const res = await client.complete([{ role: 'user', content: 'Hello fallback' }]);
    assert.strictEqual(res.provider, 'groq');
    assert.strictEqual(res.content, 'Fallback answer from Groq');
    assert.strictEqual(backupGroq.callCount, 1);
  });

  it('should route directly when completeWith is called', async () => {
    const mockOllama = new MockProvider('ollama', 'qwen2.5:7b', false, 'Answer from Qwen');
    const mockGroq = new MockProvider('groq', 'llama-3.3-70b', false, 'Answer from Groq');

    const client = new UnifiedModelClient([mockOllama, mockGroq]);

    const res = await client.completeWith('groq', [{ role: 'user', content: 'Direct to groq' }]);
    assert.strictEqual(res.provider, 'groq');
    assert.strictEqual(res.content, 'Answer from Groq');
  });
});
