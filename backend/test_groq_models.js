require('dotenv').config();

async function testModel(model) {
  const apiKey = process.env.GROQ_API_KEY;
  const body = {
    model,
    messages: [
      { role: 'user', content: 'Say ping' },
    ],
    temperature: 0.1,
    max_tokens: 10,
  };

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`✅ Model ${model} works! Response:`, data?.choices?.[0]?.message?.content);
      return true;
    } else {
      console.log(`❌ Model ${model} failed:`, data?.error?.message);
      return false;
    }
  } catch (e) {
    console.log(`❌ Model ${model} error:`, e.message);
    return false;
  }
}

(async () => {
  const models = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama3-8b-8192',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
  ];

  for (const m of models) {
    await testModel(m);
  }
})();
