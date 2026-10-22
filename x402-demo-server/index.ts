/**
 * QuickPitch AI - Main Server (Free Mode)
 *
 * This server provides free AI presentation generation endpoints.
 *
 * QUICK START:
 * 1. Start server: npm run dev
 * 2. Test: curl http://localhost:4021/health
 */

import { config } from 'dotenv';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

// Import handler functions
import { handleGeneratePpt, jobStages } from './handlers/generate-ppt';
import { handleTranscribeAudio } from './handlers/transcribe-audio';
import { handleLoadYouTubeTranscript, handleYouTubeChat } from './handlers/youtube-chat';

// Load environment variables
config();

// ════════════════════════════════════════════════════════════════════
// CONFIGURATION & SETUP
// ════════════════════════════════════════════════════════════════════

const port = parseInt(process.env.PORT || '4021', 10);

console.log('\n' + '═'.repeat(60));
console.log('QuickPitch AI - Free Server');
console.log('═'.repeat(60));
console.log('Configuration:');
console.log(`  Port: ${port}`);
console.log('═'.repeat(60) + '\n');

export type AppEnv = {
  Variables: {
    rawBodyText?: string;
    parsedBody?: any;
  };
};

// Create Hono app
export const app = new Hono<AppEnv>();

// ════════════════════════════════════════════════════════════════════
// MIDDLEWARE STACK
// ════════════════════════════════════════════════════════════════════

/**
 * CORS Middleware - MUST be first!
 */
app.use('*', async (c, next) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, HEAD',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': 'X-QuickPitch-Status, X-QuickPitch-Notice, X-QuickPitch-Provider, Content-Disposition, *',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Max-Age': '86400',
  };

  // Handle OPTIONS preflight
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Add headers to response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.header(key, value);
  });

  await next();
});

/**
 * Logging Middleware
 */
app.use('*', async (c, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${c.req.method.toUpperCase()} ${c.req.path}`);
  await next();
  console.log(`  Response: ${c.res.status}`);
});

/**
 * Body Caching Middleware
 * Preserves request JSON body for handlers
 */
app.use('*', async (c, next) => {
  if (c.req.method === 'POST' || c.req.method === 'PUT') {
    try {
      const cloned = c.req.raw.clone();
      const text = await cloned.text();
      if (text && text.trim().startsWith('{')) {
        c.set('rawBodyText', text);
        try {
          const parsed = JSON.parse(text);
          c.set('parsedBody', parsed);
        } catch { /* ignore invalid JSON */ }
      }
    } catch (e: any) {
      // Body may not be cloneable (e.g. multipart/form-data)
    }
  }
  await next();
});

// ════════════════════════════════════════════════════════════════════
// ROUTE HANDLERS - All Free Endpoints
// ════════════════════════════════════════════════════════════════════

// QuickPitch - Generate presentation (FREE)
app.post('/generate-ppt', handleGeneratePpt);

// QuickPitch - Demo mode endpoint (also FREE, kept for compatibility)
app.post('/generate-ppt-demo', handleGeneratePpt);

// QuickPitch - Real server stage status polling endpoint
app.get('/generate-ppt/status/:jobId', (c) => {
  const jobId = c.req.param('jobId');
  const stage = jobStages.get(jobId);
  if (!stage) {
    return c.json({ status: 'unknown', stage: 'ingest', percent: 15, message: 'Processing presentation...' }, 200);
  }
  return c.json({ status: 'ok', ...stage }, 200);
});

// AWS Transcribe Audio - Real speech-to-text via AWS Transcribe + S3
app.post('/transcribe-audio', handleTranscribeAudio);

// Talk with YouTube Video (Local Qwen 2.5 7B via Ollama / OpenAI-compatible REST API)
app.post('/youtube/load-transcript', handleLoadYouTubeTranscript);
app.post('/youtube/chat', handleYouTubeChat);

// Privacy: Transcript Cache Management (Delete single or all cached transcripts)
import { deleteCachedTranscript, clearTranscriptCache } from './core/transcript/transcript-cache.js';
import { getConnInfo } from '@hono/node-server/conninfo';

function isRequestFromLocalhost(c: any): boolean {
  try {
    const info = getConnInfo(c);
    const remoteAddr = info.remote?.address;
    if (remoteAddr) {
      const isLoopback = remoteAddr === '127.0.0.1' || 
                         remoteAddr === '::1' || 
                         remoteAddr === '::ffff:127.0.0.1';
      if (!isLoopback) return false;
    }
  } catch {
    const socketAddr = (c.env as any)?.incoming?.socket?.remoteAddress;
    if (socketAddr && socketAddr !== '127.0.0.1' && socketAddr !== '::1' && socketAddr !== '::ffff:127.0.0.1') {
      return false;
    }
  }
  const host = c.req.header('host') || '';
  return host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
}

app.delete('/cache/transcript', (c) => {
  if (!isRequestFromLocalhost(c)) {
    return c.json({
      error: 'Forbidden. Cache management is restricted exclusively to localhost requests.',
    }, 403);
  }

  const url = c.req.query('url');
  const key = c.req.query('key');
  const clearAll = c.req.query('all') === 'true';

  if (clearAll) {
    clearTranscriptCache();
    return c.json({
      status: 'ok',
      message: 'Transcript cache cleared completely.',
    });
  }

  if (!url && !key) {
    return c.json({
      error: 'Bad Request. Parameter all=true is required to purge entire cache, or specify ?url=... or ?key=... to delete a single transcript.',
    }, 400);
  }

  const target = url || key || '';
  const deleted = deleteCachedTranscript(target);
  return c.json({
    status: 'ok',
    target,
    deleted,
    message: deleted
      ? `Transcript cache for "${target}" was deleted.`
      : `No matching transcript cache found for "${target}".`,
  });
});

// ════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS
// ════════════════════════════════════════════════════════════════════

/**
 * Health check - Use this to verify server is running
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'quickpitch-ai-free',
    uptime: process.uptime(),
  });
});

/**
 * Info endpoint - Shows configured endpoints
 */
app.get('/info', (c) => {
  return c.json({
    service: 'quickpitch-ai-free',
    version: '2.0.0',
    mode: 'free',
    endpoints: [
      'POST /generate-ppt',
      'POST /generate-ppt-demo',
      'POST /transcribe-audio',
      'GET /health',
      'GET /info',
    ],
  });
});

// ════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ════════════════════════════════════════════════════════════════════

/**
 * 404 Handler
 */
app.notFound((c) => {
  return c.json(
    {
      error: 'Endpoint not found',
      path: c.req.path,
      hint: 'Try GET /health or GET /info for diagnostics',
    },
    404
  );
});

// ════════════════════════════════════════════════════════════════════
// SERVER STARTUP
// ════════════════════════════════════════════════════════════════════

if (!process.env.NO_AUTO_SERVE) {
  try {
    serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
      console.log('\n✅ QuickPitch AI Server is running! (Free Mode)\n');
      console.log('═'.repeat(60));
      console.log('Endpoints:');
      console.log(`  API:           http://localhost:${port}`);
      console.log(`  Generate PPT:  http://localhost:${port}/generate-ppt`);
      console.log(`  Health:        http://localhost:${port}/health`);
      console.log(`  Info:          http://localhost:${port}/info`);
      console.log('═'.repeat(60));
      console.log('\n📚 QUICK TEST:\n');
      console.log(`  curl http://localhost:${port}/health\n`);
      console.log('═'.repeat(60) + '\n');
    });
  } catch (err: any) {
    console.warn(`[Server] Already running on port ${port} or cannot bind: ${err.message}`);
  }
}