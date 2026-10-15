import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UnifiedModelClient } from '../models/unified-client.js';
import type { ILLMProvider, ChatMessage, ModelCompletionResult } from '../models/types.js';
import { synthesizeOutline, calculateSlideCount } from '../core/synthesis/outline-synthesizer.js';
import { chatWithVideo } from '../core/synthesis/video-chat.js';
import type { TranscriptData } from '../core/schemas/transcript.schema.js';

class MockJsonLLMProvider implements ILLMProvider {
  public readonly name = 'mock-json-llm';
  public readonly defaultModel = 'mock-json';
  public lastPrompt: string = '';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async complete(messages: ChatMessage[]): Promise<ModelCompletionResult> {
    this.lastPrompt = messages.map(m => m.content).join('\n');

    // If chat with video question
    if (this.lastPrompt.includes('Video Intelligence Assistant')) {
      return {
        content: 'Based on the transcript, the speaker argued for focus on average packages.',
        model: this.defaultModel,
        provider: this.name,
      };
    }

    // Default outline response
    const mockJson = JSON.stringify({
      title: 'Synthesized Executive Overview',
      subtitle: 'Key strategic takeaways and roadmap',
      pillars: [
        { name: 'Context', description: 'Domain landscape' },
        { name: 'Architecture', description: 'Core design patterns' },
      ],
      keyTopics: ['Architecture', 'Scalability', 'Evaluation'],
    });

    return {
      content: mockJson,
      model: this.defaultModel,
      provider: this.name,
    };
  }
}

describe('Core Stage 2: Synthesis & Outline Planning', () => {
  const dummyTranscript: TranscriptData = {
    sourceType: 'text',
    title: 'Distributed Systems Lecture',
    rawText: 'Full discussion about consensus and distributed computing.',
    sanitizedText: 'Full discussion about consensus and distributed computing.',
    charCount: 56,
  };

  it('should calculate appropriate slide counts based on detail level', () => {
    assert.strictEqual(calculateSlideCount(2000, 'concise'), 7);
    assert.strictEqual(calculateSlideCount(2000, 'balanced'), 7);
    assert.strictEqual(calculateSlideCount(8000, 'balanced'), 10);
    assert.strictEqual(calculateSlideCount(14000, 'detailed'), 15);
  });

  it('should synthesize a validated presentation outline via mocked model client', async () => {
    const mockProvider = new MockJsonLLMProvider();
    const client = new UnifiedModelClient([mockProvider]);

    const outline = await synthesizeOutline(dummyTranscript, client, 'balanced');

    assert.strictEqual(outline.title, 'Synthesized Executive Overview');
    assert.strictEqual(outline.pillars.length, 2);
    assert.strictEqual(outline.pillars[0].name, 'Context');
    assert.strictEqual(outline.keyTopics.length, 3);
  });

  it('should ground video Q&A questions directly in video transcript', async () => {
    const mockProvider = new MockJsonLLMProvider();
    const client = new UnifiedModelClient([mockProvider]);

    const result = await chatWithVideo(
      dummyTranscript,
      'What were the key points?',
      [],
      client
    );

    assert.ok(result.answer.includes('average packages'));
    assert.ok(mockProvider.lastPrompt.includes('Distributed Systems Lecture'));
    assert.ok(mockProvider.lastPrompt.includes('consensus and distributed computing'));
  });
});
