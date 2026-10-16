import { config } from 'dotenv';
config();
import { GroqProvider } from '../models/providers/groq.provider.js';

async function main() {
  console.log('Testing GroqProvider directly through app provider code...');
  const provider = new GroqProvider();
  const isAvail = await provider.isAvailable();
  console.log(`Provider available: ${isAvail}`);
  console.log(`Default model: ${provider.defaultModel}`);

  const start = Date.now();
  const res = await provider.complete([
    { role: 'system', content: 'You are an executive assistant. Be concise.' },
    { role: 'user', content: 'In one sentence, what is an executive slide presentation?' },
  ]);
  const elapsed = Date.now() - start;

  console.log('\n--- RAW GROQ CALL RESULT ---');
  console.log(JSON.stringify({
    content: res.content.trim(),
    model: res.model,
    provider: res.provider,
    usage: res.usage,
    elapsedMs: elapsed,
  }, null, 2));
}

main().catch(err => {
  console.error('Groq test failed:', err);
  process.exit(1);
});
