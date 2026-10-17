import dotenv from 'dotenv';
dotenv.config();
import OpenAI from 'openai';

async function main() {
  const client = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
  const resp = await client.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    temperature: 0.0,
    messages: [
      {
        role: 'system',
        content: `You are a faithful line-by-line translator.
Instruction: translate faithfully, do not add, explain or summarize, keep names and numbers.
Return ONLY a valid JSON object in this format:
{
  "translations": [
    { "lineIndex": 0, "text": "English translation for line 0" },
    { "lineIndex": 1, "text": "English translation for line 1" }
  ]
}`
      },
      {
        role: 'user',
        content: JSON.stringify({
          lines: [
            { lineIndex: 0, text: 'सोचिए कि कोई मशीन है जो आपके हिसाब से आपकी अलमारी सेट कर दे' },
            { lineIndex: 1, text: 'या आपके परिवार के हर मेंबर को उनकी पसंद के हिसाब से कॉफी सर्व कर दे' }
          ]
        }, null, 2)
      }
    ],
    response_format: { type: 'json_object' }
  });

  console.log('Response content:');
  console.log(resp.choices[0].message.content);
}

main().catch(console.error);
