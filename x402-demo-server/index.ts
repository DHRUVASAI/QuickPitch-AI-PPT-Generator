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
import { handleGeneratePpt } from './handlers/generate-ppt';
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

// Create Hono app
const app = new Hono();

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
    'Access-Control-Expose-Headers': '*',
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

// AWS Transcribe Audio - Real speech-to-text via AWS Transcribe + S3
app.post('/transcribe-audio', handleTranscribeAudio);

// Talk with YouTube Video (Local Qwen 2.5 7B via Ollama / OpenAI-compatible REST API)
app.post('/youtube/load-transcript', handleLoadYouTubeTranscript);
app.post('/youtube/chat', handleYouTubeChat);

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