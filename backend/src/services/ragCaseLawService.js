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

async function retrieveCaseLawPrecedents(queryText, topK = 3, threshold = 0.5) {
  try {
    // 1. Embed the query text
    const queryVector = await generateEmbedding(queryText, 'search_query');
    if (!queryVector) {
        console.warn(`⚠️ [RAG] Failed to embed query text for case law retrieval.`);
        return [];
    }

    // 2. Execute Native Atlas Vector Search
    const statutoryMatches = await CaseLaw.aggregate([
      {
        $vectorSearch: {
          index: "lexguard_caselaw_vector_index", // The Atlas index the user is creating
          path: "embedding",
          queryVector: queryVector,
          numCandidates: 100,
          limit: 10
        }
      },
      {
        $project: {
          case_title: 1,
          citation: 1,
          legal_domain: 1,
          summary: 1,
          similarityScore: { $meta: "vectorSearchScore" }
        }
      }
    ]);

    // 3. Filter by threshold and take top K
    const relevantMatches = statutoryMatches
        .filter(match => match.similarityScore >= threshold)
        .slice(0, topK);

    if (relevantMatches.length === 0) return [];

    // 4. Format results into structured prompt blocks
    return relevantMatches.map(doc => (
      `\n\n=== SUPREME COURT PRECEDENT ===\nCase: ${doc.case_title} [${doc.citation}]\nHolding: ${doc.summary}\n=================================\n`
    ));

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
