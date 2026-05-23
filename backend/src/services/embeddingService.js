/**
 * Service to generate vector embeddings for text using HuggingFace API.
 * Uses the lightweight and fast sentence-transformers/all-MiniLM-L6-v2 model.
 */

async function generateEmbedding(text) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY is not defined. Cannot generate embeddings.');
  }

  const model = 'sentence-transformers/all-MiniLM-L6-v2';
  const url = `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: [text],
          options: { wait_for_model: true }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HF Embedding Error (${response.status}): ${errorText}`);
      }

      const vectors = await response.json();
      // The API returns an array of arrays (one vector per input). We sent one input.
      if (Array.isArray(vectors) && vectors.length > 0 && Array.isArray(vectors[0])) {
        return vectors[0]; // Return the 384-dimensional vector
      }

      throw new Error('Invalid response format from embedding model');
    } catch (err) {
      if (attempt < 3) {
        console.warn(`⚠️ [EmbeddingService] Failed to generate embedding (attempt ${attempt}/3). Retrying in 2s...`);
        await new Promise(res => setTimeout(res, 2000));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Convenience method to embed multiple clauses and return a map of clauseId -> vector
 */
async function embedMultipleClauses(clausesTextList) {
    const vectors = [];
    for (const text of clausesTextList) {
        // Simple sequential for rate limit safety on free tier
        const vector = await generateEmbedding(text);
        vectors.push(vector);
    }
    return vectors;
}

const Clause = require('../models/Clause');

/**
 * Generate and store embeddings for all clauses in a contract.
 */
async function embedClausesForContract(contractId) {
    const clauses = await Clause.find({ contractId }).select('_id rawText embedding');
    if (!clauses || clauses.length === 0) return;

    console.log(`[EmbeddingService] Generating embeddings for ${clauses.length} clauses...`);
    
    // We can process in batches to avoid rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < clauses.length; i += BATCH_SIZE) {
        const batch = clauses.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (clause) => {
            if (clause.embedding && clause.embedding.length > 0) return; // Skip if already embedded
            const vector = await generateEmbedding(clause.rawText);
            if (vector) {
                clause.embedding = vector;
                await clause.save();
            }
        });
        await Promise.all(promises);
        
        // Brief pause between batches for free tier
        if (i + BATCH_SIZE < clauses.length) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    console.log(`✅ [EmbeddingService] Embeddings generated successfully.`);
}

module.exports = {
  generateEmbedding,
  embedMultipleClauses,
  embedClausesForContract
};
