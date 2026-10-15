import type { UnifiedModelClient } from '../../models/unified-client.js';
import type { ChatMessage } from '../../models/types.js';
import type { TranscriptData } from '../schemas/transcript.schema.js';

export interface VideoChatOptions {
  allowCloudFallback?: boolean;
}

export async function chatWithVideo(
  transcript: TranscriptData,
  question: string,
  history: ChatMessage[],
  client: UnifiedModelClient,
  options?: VideoChatOptions
): Promise<{ answer: string; modelUsed: string; provider: string; isPartial?: boolean }> {
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

  const allowCloud = options?.allowCloudFallback ?? (process.env.ALLOW_CLOUD_FALLBACK === 'true');
  const primaryName = client.getPrimaryProviderName();
  const providerOrder = [primaryName, ...client.getRegisteredProviders().filter((p) => p !== primaryName)];

  for (const providerName of providerOrder) {
    const provider = client.getProvider(providerName);
    if (!provider) continue;

    // Cloud fallback is opt-in: skip cloud providers when false
    if (!allowCloud && provider.isLocal === false) {
      continue;
    }

    try {
      if (await provider.isAvailable()) {
        console.log(`[VideoChatChain] Trying provider: ${providerName}...`);
        const completion = await client.completeWith(providerName, messages, {
          temperature: 0.3,
          maxTokens: 1200,
        });
        return {
          answer: completion.content,
          modelUsed: `${completion.model} (${providerName === 'ollama' ? 'Local GPU' : providerName})`,
          provider: providerName,
        };
      }
    } catch (err: any) {
      console.warn(`[VideoChatChain] Provider "${providerName}" failed:`, err.message);
    }
  }

  // Chain 3: Partial Result with clear message (Never fail whole request)
  console.warn('⚠️ [VideoChatChain] All LLM providers failed. Extracting keyword-matched transcript excerpt as partial answer.');
  const qTerms = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const sentences = transcript.sanitizedText.split(/(?<=[.?!])\s+/);
  const matching = sentences.filter(s => qTerms.some(term => s.toLowerCase().includes(term))).slice(0, 4);

  const excerpt = matching.length > 0 ? matching.join(' ') : transcript.sanitizedText.slice(0, 500);

  return {
    answer: `⚠️ **[Partial Result - AI Engines Timed Out]**\n\nOur neural inference models were temporarily unreachable. Here is the relevant excerpt directly from the video transcript relating to your question:\n\n> "${excerpt}"\n\n*Please ensure Ollama is running on port 11434 with qwen2.5:7b or configure a hosted GROQ_API_KEY for complete answers.*`,
    modelUsed: 'Transcript Excerpt (Offline Fallback)',
    provider: 'fallback',
    isPartial: true,
  };
}
