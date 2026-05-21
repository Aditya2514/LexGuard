const { Pinecone } = require('@pinecone-database/pinecone');

let pineconeClient = null;
let index = null;

function getPineconeIndex() {
  if (index) return index;
  
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX;

  if (!apiKey || !indexName) {
    console.warn('⚠️ [Pinecone] API Key or Index Name is missing in .env. Pinecone features will be disabled.');
    return null;
  }

  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey });
  }

  index = pineconeClient.index(indexName);
  return index;
}

/**
 * Upsert a single case law record into Pinecone.
 * @param {string} id Unique identifier for the case law vector (e.g., MongoDB ObjectId)
 * @param {Array<number>} vector 384-dimensional embedding
 * @param {Object} metadata Metadata payload containing caseName, citation, summary, etc.
 */
async function upsertCaseLaw(id, vector, metadata) {
  const pcIndex = getPineconeIndex();
  if (!pcIndex) return;

  try {
    const payload = [{
      id,
      values: Array.from(vector),
      metadata
    }];
    await pcIndex.upsert({
      records: [{
        id,
        values: Array.from(vector).map(v => parseFloat(v)),
        metadata
      }]
    });
    console.log(`[Pinecone] Successfully upserted vector for Case Law: ${metadata.caseName}`);
  } catch (error) {
    console.error(`[Pinecone] Failed to upsert vector:`, error.message);
  }
}

/**
 * Query Pinecone for top-K matching case laws.
 * @param {Array<number>} queryVector 384-dimensional embedding
 * @param {number} topK Number of results to return
 * @param {number} minScoreThreshold Minimum cosine similarity score to qualify as a match
 * @returns {Array<Object>} Array of matching metadata objects with relevance scores
 */
async function queryCaseLaw(queryVector, topK = 2, minScoreThreshold = 0.50) {
  const pcIndex = getPineconeIndex();
  if (!pcIndex) return [];

  try {
    const response = await pcIndex.query({
      vector: queryVector,
      topK,
      includeMetadata: true
    });

    if (response.matches && response.matches.length > 0) {
      return response.matches
        .filter(match => match.score >= minScoreThreshold)
        .map(match => ({
          score: match.score,
          ...match.metadata
        }));
    }
    return [];
  } catch (error) {
    console.error(`[Pinecone] Query failed:`, error.message);
    return [];
  }
}

module.exports = {
  getPineconeIndex,
  upsertCaseLaw,
  queryCaseLaw
};
