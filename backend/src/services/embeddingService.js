const { pipeline, env } = require('@xenova/transformers');
const Clause = require('../models/Clause');

// Configure Transformers.js to use local cache if needed, though default is usually fine.
// Some environments need env.allowLocalModels = false if pulling from HF directly.

class EmbeddingService {
  constructor() {
    this.modelName = 'Xenova/bge-m3'; 
    this.extractor = null;
    this.initPromise = null;
  }

  async init() {
    if (this.extractor) return;
    if (!this.initPromise) {
      this.initPromise = pipeline('feature-extraction', this.modelName);
    }
    this.extractor = await this.initPromise;
  }

  async generateEmbedding(text, taskType = 'search_document') {
    await this.init();
    
    // BGE-m3 does not require prefixes. Just clean the text.
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Process through transformers.js pipeline
    const output = await this.extractor(cleanText, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data);
  }
}

const embeddingServiceInstance = new EmbeddingService();

async function generateEmbedding(text, taskType = 'search_document') {
    return embeddingServiceInstance.generateEmbedding(text, taskType);
}

// Keep the existing helper functions
async function embedMultipleClauses(clausesTextList) {
    const vectors = [];
    for (const text of clausesTextList) {
        const vector = await generateEmbedding(text, 'search_document');
        vectors.push(vector);
    }
    return vectors;
}

async function embedClausesForContract(contractId) {
    const clauses = await Clause.find({ contractId }).select('_id rawText embedding');
    if (!clauses || clauses.length === 0) return;

    console.log(`[EmbeddingService] Generating embeddings for ${clauses.length} clauses...`);
    
    for (let i = 0; i < clauses.length; i++) {
        const clause = clauses[i];
        if (clause.embedding && clause.embedding.length > 0) continue; 
        const vector = await generateEmbedding(clause.rawText, 'search_document');
        if (vector) {
            clause.embedding = vector;
            await clause.save();
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

async function searchSimilarClauses(contractId, queryTextOrVector, topK = 3) {
  let queryVector;
  if (Array.isArray(queryTextOrVector)) {
    queryVector = queryTextOrVector;
  } else {
    queryVector = await generateEmbedding(queryTextOrVector, 'search_query');
  }
  if (!queryVector) return [];

  const clauses = await Clause.find({
    contractId,
    embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
  }).select('_id rawText embedding segmentIndex');
  
  const scoredClauses = clauses
    .filter(c => Array.isArray(c.embedding) && c.embedding.length > 0) 
    .map(c => ({
      clauseId: c._id,
      segmentIndex: c.segmentIndex,
      rawText: c.rawText,
      score: cosineSimilarity(queryVector, c.embedding)
    }))
    .filter(c => !isNaN(c.score)); 

  scoredClauses.sort((a, b) => b.score - a.score);
  return scoredClauses.slice(0, topK);
}

module.exports = {
  generateEmbedding,
  embedMultipleClauses,
  embedClausesForContract,
  searchSimilarClauses
};
