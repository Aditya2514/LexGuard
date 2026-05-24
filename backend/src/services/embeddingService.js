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

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Searches for clauses similar to the query string within the same contract
 * using in-memory cosine similarity (Zero-Rupee RAG).
 */
async function searchSimilarClauses(contractId, queryText, topK = 3) {
  const queryVector = await generateEmbedding(queryText);
  if (!queryVector) return [];

  // Fetch all clauses for this contract that have embeddings
  const clauses = await Clause.find({ contractId, embedding: { $ne: null } }).select('_id rawText embedding segmentIndex');
  
  const scoredClauses = clauses.map(c => ({
    clauseId: c._id,
    segmentIndex: c.segmentIndex,
    rawText: c.rawText,
    score: cosineSimilarity(queryVector, c.embedding)
  }));

  // Sort by highest similarity
  scoredClauses.sort((a, b) => b.score - a.score);
  return scoredClauses.slice(0, topK);
}

module.exports = {
  generateEmbedding,
  embedMultipleClauses,
  embedClausesForContract,
  searchSimilarClauses
};
