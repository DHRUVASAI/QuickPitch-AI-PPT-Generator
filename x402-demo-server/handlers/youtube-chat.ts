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

    return c.json({
      success: true,
      title: data.title,
      transcriptSnippet: data.sanitizedText.slice(0, 400) + '...',
      charCount: data.charCount,
      sampleQuestions: [
        'What are the main takeaways of this video?',
        'Can you summarize the key problem and solution discussed?',
        'What specific examples or stories did the speaker share?',
      ],
    });
  } catch (error: any) {
    console.error('[TalkWithYT] Error loading transcript:', error);
    return c.json({ error: error.message || 'Failed to extract transcript' }, 500);
  }
}

/**
 * POST /youtube/chat
 * Responds with answers grounded in the YouTube transcript using the swappable model client
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

    const { url, question, history = [] } = body;
    if (!url) {
      return c.json({ error: 'YouTube URL is required' }, 400);
    }
    if (!question || !question.trim()) {
      return c.json({ error: 'Question is required' }, 400);
    }

    const modelClient = getModelClient();
    const transcript = await extractTranscript({ sourceType: 'youtube', url });

    console.log(`[TalkWithYT] Asking question on video "${transcript.title}" using UnifiedModelClient (${modelClient.getPrimaryProviderName()})...`);

    const result = await chatWithVideo(transcript, question, history, modelClient);

    return c.json({
      success: true,
      answer: result.answer,
      videoTitle: transcript.title,
      modelUsed: result.modelUsed,
      provider: result.provider,
    });
  } catch (error: any) {
    console.error('[TalkWithYT] Chat error:', error);
    return c.json({ error: error.message || 'Chat generation failed' }, 500);
  }
}
