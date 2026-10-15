import type { UnifiedModelClient } from '../../models/unified-client.js';
import type { ChatMessage } from '../../models/types.js';
import type { TranscriptData } from '../schemas/transcript.schema.js';

export async function chatWithVideo(
  transcript: TranscriptData,
  question: string,
  history: ChatMessage[],
  client: UnifiedModelClient
): Promise<{ answer: string; modelUsed: string; provider: string }> {
  if (!question || !question.trim()) {
    throw new Error('Question is required');
  }

  const systemPrompt = `You are QuickPitch AI's Video Intelligence Assistant.
You have access to the COMPLETE TRANSCRIPT of the video titled "${transcript.title}".

YOUR RULES:
1. Answer the user's questions ACCURATELY and THOROUGHLY based on the transcript provided below.
2. Directly cite timestamps, concepts, quotes, and specific examples whenever mentioned.
3. If the transcript does not provide the answer, acknowledge what the speaker discussed and explain what is missing without hallucinating.
4. Keep your answer crisp, clear, and well-structured using markdown bullets, bold headings, and quotes where suitable.

=== VIDEO TITLE ===
${transcript.title}

=== VIDEO TRANSCRIPT ===
${transcript.sanitizedText.slice(0, 30000)}
`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Include last 6 conversational turns for continuity
  if (Array.isArray(history)) {
    for (const msg of history.slice(-6)) {
      if (msg.role && msg.content) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }
  }

  messages.push({ role: 'user', content: question });

  const completion = await client.complete(messages, {
    temperature: 0.3,
    maxTokens: 1200,
  });

  return {
    answer: completion.content,
    modelUsed: `${completion.model} (${completion.provider === 'ollama' ? 'Local GPU' : completion.provider})`,
    provider: completion.provider,
  };
}
