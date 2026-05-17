require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

(async () => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: process.env.AI_MODEL_NAME,
    systemInstruction: 'Output JSON: {"status":"ok"}',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const result = await model.generateContent('Say hello');
  const resp = result.response;
  
  console.log('Candidates:', JSON.stringify(resp.candidates?.[0]?.content?.parts, null, 2));
  console.log('---');
  try { console.log('text():', resp.text()); } catch(e) { console.log('text() error:', e.message); }
})().catch(e => console.error('Error:', e.message));
