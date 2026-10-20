import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error('GROQ_API_KEY is not set in environment or .env');
    process.exit(1);
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });

    if (!res.ok) {
      console.error(`HTTP ${res.status}: ${await res.text()}`);
      process.exit(1);
    }

    const data = await res.json();
    const models = (data.data || []).map((m: any) => ({
      id: m.id,
      created: m.created,
      owned_by: m.owned_by,
      active: m.active,
      context_window: m.context_window,
    }));

    console.log(JSON.stringify(models, null, 2));
  } catch (err) {
    console.error('Error fetching Groq models:', err);
    process.exit(1);
  }
}

main();
