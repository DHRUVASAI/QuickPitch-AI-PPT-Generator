import { OllamaProvider } from '../models/providers/ollama.provider.js';

async function evaluate() {
  const provider = new OllamaProvider({ genTimeoutMs: 180000 });
  if (!(await provider.isAvailable())) {
    console.error('Ollama is not available!');
    return;
  }

  console.log('Testing Qwen 2.5:7b output in Hindi (Devanagari)...');
  const hindiPrompt = `You are a professional presentation architect. Create a structured 1-slide summary strictly in native Hindi (Devanagari script) on the topic "What is Artificial Intelligence? (आर्टिफिशियल इंटेलिजेंस क्या है?)".

Output strictly valid JSON matching:
{
  "title": "हिंदी स्लाइड शीर्षक",
  "category": "श्रेणी",
  "points": [
    "पहला बिंदु (स्पष्ट और सटीक हिंदी)",
    "दूसरा बिंदु",
    "तीसरा बिंदु"
  ]
}`;

  const t0 = Date.now();
  const hindiRes = await provider.complete([{ role: 'user', content: hindiPrompt }], { jsonMode: true });
  const hindiTime = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n--- HINDI OUTPUT (${hindiTime}s) ---`);
  console.log(hindiRes.content);

  console.log('\nTesting Qwen 2.5:7b output in Telugu (తెలుగు)...');
  const teluguPrompt = `You are a professional presentation architect. Create a structured 1-slide summary strictly in native Telugu script (తెలుగు) on the topic "What is Artificial Intelligence? (ఆర్టిఫిషియల్ ఇంటెలిజెన్స్ అంటే ఏమిటి?)".

Output strictly valid JSON matching:
{
  "title": "తెలుగు స్లైడ్ శీర్షిక",
  "category": "విభాగం",
  "points": [
    "మొదటి పాయింట్ (స్పష్టమైన తెలుగు)",
    "రెండవ పాయింట్",
    "మూడవ పాయింట్"
  ]
}`;

  const t1 = Date.now();
  const teluguRes = await provider.complete([{ role: 'user', content: teluguPrompt }], { jsonMode: true });
  const teluguTime = ((Date.now() - t1) / 1000).toFixed(1);
  console.log(`\n--- TELUGU OUTPUT (${teluguTime}s) ---`);
  console.log(teluguRes.content);
}

evaluate().catch(console.error);
