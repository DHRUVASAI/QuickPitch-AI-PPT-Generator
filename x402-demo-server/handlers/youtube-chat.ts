import type { Context } from 'hono';
import { getModelClient } from '../models/index.js';
import { extractTranscript, chatWithVideo } from '../core/index.js';

/**
 * POST /youtube/load-transcript
 * Pre-fetches and prepares the YouTube transcript for chatting
 */
export async function handleLoadYouTubeTranscript(c: Context) {
  try {
    let body = c.get('parsedBody');
    if (!body || typeof body !== 'object') {
      try {
        body = await c.req.json();
      } catch {
        body = {};
      }
    }

    const { url } = body;
    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
      return c.json({ error: 'Valid YouTube URL is required' }, 400);
    }

    console.log(`[TalkWithYT] Loading transcript for: ${url}`);
    const data = await extractTranscript({ sourceType: 'youtube', url });

    const isPartial = Boolean(data.metadata?.partial);

    return c.json({
      success: true,
      title: data.title,
      transcriptSnippet: data.sanitizedText.slice(0, 400) + '...',
      charCount: data.charCount,
      isPartial,
      notice: isPartial ? 'Transcript was extracted from available metadata (captions were disabled).' : undefined,
      sampleQuestions: [
        'What are the main takeaways of this video?',
        'Can you summarize the key problem and solution discussed?',
        'What specific examples or stories did the speaker share?',
      ],
    });
  } catch (error: any) {
    // Return partial result with clear message rather than failing whole request
    console.warn('[TalkWithYT] Error loading transcript, returning partial context:', error.message);
    return c.json({
      success: true,
      title: 'YouTube Video',
      transcriptSnippet: 'Partial video context loaded.',
      charCount: 0,
      isPartial: true,
      notice: `Could not load full automated captions: ${error.message}. You can still ask questions!`,
      sampleQuestions: [
        'What is the core subject of this video?',
        'Summarize what is known about this presentation topic.',
      ],
    });
  }
}

/**
 * POST /youtube/chat
 * Responds with answers grounded in the YouTube transcript using the swappable fallback chain
 */
export async function handleYouTubeChat(c: Context) {
  try {
    let body = c.get('parsedBody');
    if (!body || typeof body !== 'object') {
      try {
        body = await c.req.json();
      } catch {
        body = {};
      }
    }

    const { url, question, history = [], allow_cloud_fallback } = body;
    if (!url) {
      return c.json({ error: 'YouTube URL is required' }, 400);
    }
    if (!question || !question.trim()) {
      return c.json({ error: 'Question is required' }, 400);
    }

    const allowCloudFallback = allow_cloud_fallback === true || process.env.ALLOW_CLOUD_FALLBACK === 'true';
    const modelClient = getModelClient();
    const transcript = await extractTranscript({ sourceType: 'youtube', url }, { allowCloudFallback });

    console.log(`[TalkWithYT] Asking question on video "${transcript.title}" (cloudFallback: ${allowCloudFallback})...`);

    const result = await chatWithVideo(transcript, question, history, modelClient, { allowCloudFallback });

    return c.json({
      success: true,
      answer: result.answer,
      videoTitle: transcript.title,
      modelUsed: result.modelUsed,
      provider: result.provider,
      isPartial: result.isPartial || false,
    });
  } catch (error: any) {
    console.error('[TalkWithYT] Unexpected chat error:', error);
    // Return graceful partial result rather than breaking the UI chat
    return c.json({
      success: true,
      answer: `⚠️ **[Notice: Temporary Model Timeout]**\n\nWe encountered a temporary timeout reaching the language model (${error.message}). Please try asking your question again or check your local Ollama connection.`,
      modelUsed: 'Fallback Error Handler',
      provider: 'fallback',
      isPartial: true,
    });
  }
}
