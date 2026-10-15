import type { Context } from 'hono';
import { YoutubeTranscript } from 'youtube-transcript';
import OpenAI from 'openai';
import 'dotenv/config';

// Initialize OpenAI client pointing to Local Ollama OpenAI-compatible REST API
const localOllama = new OpenAI({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1',
  apiKey: 'ollama', // Dummy key for Ollama
});

// Cache transcripts in-memory per URL to avoid re-fetching
const transcriptCache = new Map<string, { title: string; transcript: string; fetchedAt: number }>();

async function fetchYouTubeMetadata(url: string): Promise<{ title: string; description: string }> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const html = await res.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/i) || html.match(/<meta property="og:title" content="(.*?)"/i);
    const descMatch = html.match(/<meta property="og:description" content="(.*?)"/i) || html.match(/<meta name="description" content="(.*?)"/i);
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : '';
    const description = descMatch ? descMatch[1].trim() : '';
    return { title, description };
  } catch (e) {
    return { title: '', description: '' };
  }
}

async function extractVideoTranscript(url: string): Promise<{ title: string; transcript: string }> {
  const cached = transcriptCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < 1000 * 60 * 60) {
    return cached;
  }

  const meta = await fetchYouTubeMetadata(url);
  let transcript = '';

  const fetchWithTimeout = (promise: Promise<any>, timeoutMs: number = 10000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), timeoutMs))
    ]);
  };

  try {
    const lines: any = await fetchWithTimeout(YoutubeTranscript.fetchTranscript(url, { lang: 'en' }), 10000);
    transcript = lines.map((t: any) => t.text).join(' ');
  } catch (err) {
    try {
      const lines: any = await fetchWithTimeout(YoutubeTranscript.fetchTranscript(url), 10000);
      transcript = lines.map((t: any) => t.text).join(' ');
    } catch (e2) {
      transcript = `${meta.title}. ${meta.description}`;
    }
  }

  const cleaned = transcript.replace(/\s+/g, ' ').trim();
  const result = {
    title: meta.title || 'YouTube Video',
    transcript: cleaned.slice(0, 30000), // Keep generous window for Qwen 2.5 32k context
    fetchedAt: Date.now()
  };

  transcriptCache.set(url, result);
  return result;
}

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
    const data = await extractVideoTranscript(url);

    return c.json({
      success: true,
      title: data.title,
      transcriptSnippet: data.transcript.slice(0, 400) + '...',
      charCount: data.transcript.length,
      sampleQuestions: [
        'What are the main takeaways of this video?',
        'Can you summarize the key problem and solution discussed?',
        'What specific examples or stories did the speaker share?'
      ]
    });
  } catch (error: any) {
    console.error('[TalkWithYT] Error loading transcript:', error);
    return c.json({ error: error.message || 'Failed to extract transcript' }, 500);
  }
}

/**
 * POST /youtube/chat
 * Streams or responds with answers grounded in the YouTube transcript using Qwen 2.5 7B (Ollama)
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

    // 1. Fetch or get cached transcript
    const videoData = await extractVideoTranscript(url);
    const videoTranscript = videoData.transcript;
    const videoTitle = videoData.title;

    // 2. Build system prompt grounded strictly in the transcript
    const systemPrompt = `You are QuickPitch AI's Video Intelligence Assistant.
You have access to the COMPLETE TRANSCRIPT of the YouTube video titled "${videoTitle}".

YOUR RULES:
1. Answer the user's questions ACCURATELY and THOROUGHLY based on the transcript provided below.
2. Directly cite timestamps, concepts, quotes, and specific examples whenever mentioned.
3. If the transcript does not provide the answer, acknowledge what the speaker discussed and explain what is missing without hallucinating.
4. Keep your answer crisp, clear, and well-structured using markdown bullets, bold headings, and quotes where suitable.

=== VIDEO TITLE ===
${videoTitle}

=== VIDEO TRANSCRIPT ===
${videoTranscript || 'No transcript text available. Use video title and description for context.'}
`;

    // 3. Format message history for OpenAI-compatible REST API
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Include up to last 6 chat history turns
    if (Array.isArray(history)) {
      for (const msg of history.slice(-6)) {
        if (msg.role && msg.content) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          });
        }
      }
    }

    // Add current user question
    messages.push({ role: 'user', content: question });

    console.log(`[TalkWithYT] Prompting local Qwen 2.5:7b for question: "${question.slice(0, 60)}..."`);

    let answer = '';

    // Primary: Local Ollama Qwen 2.5 7B on port 11434
    try {
      const response = await localOllama.chat.completions.create({
        model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
        messages,
        temperature: 0.3,
        max_tokens: 1000,
      });

      answer = response.choices[0]?.message?.content || '';
    } catch (ollamaErr: any) {
      console.warn('[TalkWithYT] Local Ollama call failed, trying Groq fallback:', ollamaErr.message);

      // Cloud Fallback: Groq if local Ollama is not active
      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey) {
        const groqClient = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
        const groqResp = await groqClient.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.3,
          max_tokens: 1000,
        });
        answer = groqResp.choices[0]?.message?.content || '';
      } else {
        throw new Error('Local Ollama is unreachable on port 11434 and no GROQ_API_KEY is configured.');
      }
    }

    return c.json({
      success: true,
      answer,
      videoTitle,
      modelUsed: 'qwen2.5:7b (Local GPU)'
    });
  } catch (error: any) {
    console.error('[TalkWithYT] Chat error:', error);
    return c.json({ error: error.message || 'Chat generation failed' }, 500);
  }
}
