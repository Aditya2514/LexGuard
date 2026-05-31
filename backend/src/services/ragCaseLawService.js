const CaseLaw = require('../models/CaseLaw');
const { generateEmbedding } = require('./embeddingService');

// Optimized in-memory Cosine Similarity
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
 * Searches the Case Law database for the most relevant precedents based on the query text.
 * Uses native in-memory cosine similarity against the 384-dimensional embeddings.
 * 
 * @param {string} queryText - The contract clause or query string
 * @param {number} topK - Number of results to return
 * @param {number} threshold - Minimum cosine similarity threshold (e.g. 0.5)
 * @returns {Promise<Array>} - Array of matching case law documents
 */
async function retrieveCaseLawPrecedents(queryText, topK = 3, threshold = 0.5) {
  try {
    // 1. Embed the query text
    const queryVector = await generateEmbedding(queryText, 'search_query');
    if (!queryVector) {
        console.warn(`⚠️ [RAG] Failed to embed query text for case law retrieval.`);
        return [];
    }

    // 2. Fetch all case law embeddings from MongoDB into memory
    // (This is blazing fast for < 10,000 cases. For millions, switch to Atlas Vector Search)
    const cases = await CaseLaw.find({ embedding: { $ne: null, $not: { $size: 0 } } }).lean();

    // 3. Compute cosine similarity for each case
    const scoredCases = [];
    for (const caseDoc of cases) {
        const score = cosineSimilarity(queryVector, caseDoc.embedding);
        if (score >= threshold) {
            scoredCases.push({
                ...caseDoc,
                score
            });
        }
    }

    // 4. Sort and return top K
    scoredCases.sort((a, b) => b.score - a.score);
    return scoredCases.slice(0, topK);

  } catch (error) {
    console.error(`🚨 [Case Law RAG Failure]:`, error.message);
    return []; // Fail gracefully, return no precedents
  }
}

/**
 * Convenience function to seed a new case law entry.
 * Generates the embedding automatically before saving.
 */
async function seedCaseLaw(case_title, citation, legal_domain, summary) {
    const embedding = await generateEmbedding(summary, 'search_document');
    if (!embedding) throw new Error("Failed to generate embedding for case law.");

    const newCase = await CaseLaw.create({
        case_title,
        citation,
        legal_domain,
        summary,
        embedding
    });
    console.log(`📚 Seeded Case Law: ${case_title}`);
    return newCase;
}

module.exports = {
  retrieveCaseLawPrecedents,
  seedCaseLaw
};
