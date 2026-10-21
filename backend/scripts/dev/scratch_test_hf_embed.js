const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function test() {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  console.log('HF API Key:', apiKey ? 'FOUND' : 'MISSING');

  // Try different URLs
  const urls = [
    'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2',
    'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
    'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction'
  ];

  for (const url of urls) {
    console.log(`\nProbing URL: ${url}`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'This is a test sentence.' }),
      });
      
      console.log('Status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('Success! Format:', Array.isArray(data) ? `Array (length: ${data.length})` : typeof data);
        if (Array.isArray(data)) {
          console.log('First 5 elements:', data.slice(0, 5));
        }
      } else {
        const err = await res.text();
        console.log('Error:', err.substring(0, 200));
      }
    } catch (err) {
      console.log('Exception:', err.message);
    }
  }
}

test();
