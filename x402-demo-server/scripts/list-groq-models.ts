import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error('No GROQ_API_KEY in .env');
    return;
  }
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await res.json();
  if (data.data) {
    console.log('GROQ_MODELS_RAW:');
    console.log(JSON.stringify(data.data.map((m: any) => m.id), null, 2));
  } else {
    console.error('Groq API Error:', data);
  }
}

main();
