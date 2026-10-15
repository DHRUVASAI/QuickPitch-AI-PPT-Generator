import { describe, it } from 'node:test';
import assert from 'node:assert';
import { withRetryAndTimeout, TimeoutError } from '../core/utils/retry.js';
import { UnifiedModelClient } from '../models/unified-client.js';
import type { ILLMProvider, ChatMessage, ModelCompletionResult } from '../models/types.js';
import { synthesizeOutline } from '../core/synthesis/outline-synthesizer.js';
import { planSlideStructure } from '../core/synthesis/slide-planner.js';
import { chatWithVideo } from '../core/synthesis/video-chat.js';
import type { TranscriptData } from '../core/schemas/transcript.schema.js';

describe('Resilience & Fallback Chains', () => {
  const dummyTranscript: TranscriptData = {
    sourceType: 'text',
    title: 'Fault Tolerant Architecture',
    rawText: 'Discussion of timeout handling, exponential backoff, and circuit breaking.',
    sanitizedText: 'Discussion of timeout handling, exponential backoff, and circuit breaking.',
    charCount: 75,
  };

  it('withRetryAndTimeout should retry on failure and succeed if subsequent attempt succeeds', async () => {
    let attempts = 0;
    const result = await withRetryAndTimeout(
      async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Transient network glitch');
        }
        return 'success';
      },
      { name: 'test-retry', retries: 2, initialDelayMs: 10, backoffFactor: 2 }
    );

    assert.strictEqual(result, 'success');
    assert.strictEqual(attempts, 2);
  });

  it('withRetryAndTimeout should throw TimeoutError when operation exceeds timeout', async () => {
    await assert.rejects(
      async () => {
        await withRetryAndTimeout(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return 'should not reach';
          },
          { name: 'test-timeout', timeoutMs: 50, retries: 0 }
        );
      },
      (err: any) => err instanceof TimeoutError && err.message.includes('exceeded timeout')
    );
  });

  it('should retry once with error message when schema validation fails on first attempt', async () => {
    let callCount = 0;
    let receivedErrorMessageInCorrection = false;

    class FlakyValidationProvider implements ILLMProvider {
      public readonly name = 'flaky-llm';
      public readonly defaultModel = 'flaky-v1';

      async isAvailable(): Promise<boolean> {
        return true;
      }

      async complete(messages: ChatMessage[]): Promise<ModelCompletionResult> {
        callCount++;

        // First attempt: returns invalid schema (missing title and invalid pillars)
        if (callCount === 1) {
          return {
            content: '{"broken": true}',
            model: this.defaultModel,
            provider: this.name,
          };
        }

        // Second attempt: verify that the error feedback was sent in the prompt
        const lastUserMsg = messages[messages.length - 1]?.content || '';
        if (lastUserMsg.includes('failed schema validation') || lastUserMsg.includes('ValidationError')) {
          receivedErrorMessageInCorrection = true;
        }

        return {
          content: JSON.stringify({
            title: 'Corrected Architecture Outline',
            subtitle: 'Fixed on second attempt with error message',
            pillars: [
              { name: 'Resilience', description: 'Graceful degradation' },
              { name: 'Fallback', description: 'Safe recovery mode' },
            ],
            keyTopics: ['Retries', 'Timeouts', 'Backoff'],
          }),
          model: this.defaultModel,
          provider: this.name,
        };
      }
    }

    const flakyProvider = new FlakyValidationProvider();
    const client = new UnifiedModelClient([flakyProvider]);

    const outline = await synthesizeOutline(dummyTranscript, client, 'balanced');

    assert.strictEqual(callCount, 2);
    assert.strictEqual(receivedErrorMessageInCorrection, true);
    assert.strictEqual(outline.title, 'Corrected Architecture Outline');
    assert.strictEqual(outline.pillars.length, 2);
  });

  it('should return a partial result with a clear message when all providers fail', async () => {
    class CompletelyBrokenProvider implements ILLMProvider {
      public readonly name = 'broken-llm';
      public readonly defaultModel = 'broken-v1';

      async isAvailable(): Promise<boolean> {
        return true;
      }

      async complete(): Promise<ModelCompletionResult> {
        throw new Error('500 Service Unavailable from all model endpoints');
      }
    }

    const client = new UnifiedModelClient([new CompletelyBrokenProvider()]);

    // 1. Outline should return partial outline rather than throwing
    const outline = await synthesizeOutline(dummyTranscript, client, 'balanced');
    assert.ok(outline.subtitle.includes('Partial'));
    assert.ok(outline.rawSynthesis.includes('Partial Result'));

    // 2. Slide planner should return partial slide deck rather than throwing
    const slideDeck = await planSlideStructure(outline, dummyTranscript, client, 'cyber-blue', 'balanced');
    assert.ok(slideDeck.slides.length >= 4);
    assert.ok(slideDeck.slides[0].subtitle?.includes('Partial Result'));

    // 3. Video chat should return partial answer grounded in transcript with clear warning
    const chatResult = await chatWithVideo(dummyTranscript, 'Explain circuit breaking', [], client);
    assert.strictEqual(chatResult.isPartial, true);
    assert.ok(chatResult.answer.includes('Partial Result'));
    assert.ok(chatResult.answer.includes('circuit breaking'));
  });
});
