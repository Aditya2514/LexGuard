const mongoose = require('mongoose');
const LawSection = require('../models/LawSection');
const { LEGAL_PLAYBOOK } = require('../config/legalPlaybook');

// ── In-Memory LRU Cache for Law Retrieval ────────────────────────────────────
const MAX_CACHE_ENTRIES = 50;
const lawCache = new Map();

/**
 * Retrieve a value from the LRU cache, updating its insertion order.
 */
function getFromCache(key) {
  if (!lawCache.has(key)) return null;
  const value = lawCache.get(key);
  // Delete and set again to move to the end (most recently used)
  lawCache.delete(key);
  lawCache.set(key, value);
  return value;
}

/**
 * Store a value in the LRU cache, evicting the oldest entry if size limit is reached.
 */
function setCache(key, value) {
  if (lawCache.has(key)) {
    lawCache.delete(key);
  } else if (lawCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = lawCache.keys().next().value;
    lawCache.delete(oldestKey);
  }
  lawCache.set(key, value);
}

/**
 * Construct a lightweight, robust cache key from the clause type and content snippet.
 */
function buildCacheKey(clauseText, clauseType) {
  const normType = (clauseType || 'unknown').toLowerCase().trim();
  const snippet = (clauseText || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120); // Normalise whitespace and slice snippet
  return `${normType}::${snippet}`;
}

/**
 * Call Hugging Face feature extraction endpoint to get text embeddings
 */
async function getEmbedding(text) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY is not defined.');
  }

  const model = 'sentence-transformers/all-MiniLM-L6-v2';
  const url = `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
      });

      if (res.status === 503) {
        // Model is loading, sleep and retry
        console.warn(`[Embeddings] HF model loading (503), attempt #${attempt} sleeping 2.5s...`);
        await new Promise(resolve => setTimeout(resolve, 2500));
        continue;
      }

      if (!res.ok) {
        const bodyText = await res.text();
        throw new Error(`HF embedding API failed with ${res.status}: ${bodyText}`);
      }

      const embedding = await res.json();
      
      // Standard return value is a 1D float array or a nested 2D array [[emb]]
      if (Array.isArray(embedding) && Array.isArray(embedding[0])) {
        return embedding[0];
      }
      if (Array.isArray(embedding)) {
        return embedding;
      }
      throw new Error(`Unexpected embedding format: ${typeof embedding}`);
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Calculate cosine similarity of two vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
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
 * Triple-Layered Legal Law Retriever with LRU In-Memory Cache
 * 
 * Retrieves relevant legal bare acts/rules using a dynamic fallback hierarchy:
 * 1. Tier 1a: Dynamic Semantic Vector Similarity Search using Hugging Face sentences-transformers embeddings.
 * 2. Tier 1b: Dynamic MongoDB keyword / full-text index matching (if HF embeddings are offline).
 * 3. Tier 2: Static local rules playbook matching keyed by clause_type (zero-latency, fail-safe fallback).
 * 4. Tier 3: Safe empty array fallback.
 */
async function retrieveRelevantLaws(clauseText, clauseType, limit = 2) {
  const normalizedType = (clauseType || 'other').toLowerCase().trim();
  const cacheKey = buildCacheKey(clauseText, normalizedType);

  // Check cache first
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log(`[RAG-Retriever] Cache HIT for key: "${cacheKey}". Returning cached laws.`);
    return cached;
  }

  let finalResults = [];

  // Tier 1a: Try Dynamic Semantic Vector Search using HF embeddings and cosine similarity
  try {
    if (mongoose.connection.readyState === 1 && process.env.HUGGINGFACE_API_KEY) {
      console.log(`[RAG-Retriever] Running Semantic search. Generating query vector...`);
      const queryVector = await getEmbedding(clauseText);
      
      const sections = await LawSection.find({});
      if (sections.length > 0) {
        console.log(`[RAG-Retriever] Comparing against ${sections.length} candidates using local cosine similarity...`);
        const scoredSections = [];
        
        for (const sec of sections) {
          let secVector = sec.embedding;
          
          // Lazy evaluation & database vector caching
          if (!secVector || secVector.length === 0) {
            try {
              const textToEmbed = `${sec.title} ${sec.content}`;
              console.log(`[RAG-Retriever] Lazy-generating vector embedding for ${sec.actKey} Section ${sec.sectionNumber}`);
              secVector = await getEmbedding(textToEmbed);
              
              sec.embedding = secVector;
              await sec.save();
            } catch (embedErr) {
              console.warn(`⚠️ [RAG-Retriever] Lazy embedding generation failed for ${sec.actKey}:`, embedErr.message);
              continue;
            }
          }

          const score = cosineSimilarity(queryVector, secVector);
          scoredSections.push({ section: sec, score });
        }

        // Sort by similarity score descending
        scoredSections.sort((a, b) => b.score - a.score);

        const matches = scoredSections.slice(0, limit).map((m) => m.section);
        if (matches.length > 0) {
          console.log(`[RAG-Retriever] Semantic matches successful. Top score: ${scoredSections[0]?.score.toFixed(4)}`);
          finalResults = matches.map((m) => ({
            actKey: m.actKey,
            actName: m.actName,
            sectionNumber: m.sectionNumber,
            title: m.title,
            content: m.content,
            referenceUrl: m.referenceUrl,
          }));
        }
      }
    }
  } catch (err) {
    console.warn(`⚠️ [RAG-Retriever] Semantic Embedding search failed: ${err.message}. Cascading to Keyword search fallback...`);
  }

  // Tier 1b: Fallback to Dynamic MongoDB Full-Text & Keyword Hybrid Query
  if (finalResults.length === 0) {
    try {
      if (mongoose.connection.readyState === 1) {
        // 1. Fetch exact keyword matches for the clause category
        const exactMatches = await LawSection.find({ keywords: normalizedType }).limit(limit);

        // 2. If exact matches are fewer than the limit, run full-text search to fill the remaining slots
        let combined = [...exactMatches];
        if (combined.length < limit) {
          const boostedQuery = `${normalizedType.replace(/_/g, ' ')} ${clauseText}`;
          const textMatches = await LawSection.find(
            { $text: { $search: boostedQuery } },
            { score: { $meta: 'textScore' } }
          )
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit);

          // Deduplicate by actKey and sectionNumber
          for (const tm of textMatches) {
            if (!combined.some(c => c.actKey === tm.actKey && c.sectionNumber === tm.sectionNumber)) {
              combined.push(tm);
            }
          }
        }

        const finalMatches = combined.slice(0, limit);

        if (finalMatches && finalMatches.length > 0) {
          console.log(`[RAG-Retriever] Dynamic keyword match successful! Found ${finalMatches.length} references in MongoDB.`);
          finalResults = finalMatches.map((m) => ({
            actKey: m.actKey,
            actName: m.actName,
            sectionNumber: m.sectionNumber,
            title: m.title,
            content: m.content,
            referenceUrl: m.referenceUrl,
          }));
        }
      }
    } catch (err) {
      console.warn(`⚠️ [RAG-Retriever] Dynamic keyword search failed: ${err.message}. Cascading to Tier 2 (Static Playbook)...`);
    }
  }

  // Tier 2: Fallback to Local Curated Playbook Config
  if (finalResults.length === 0) {
    try {
      const playbookMatch = LEGAL_PLAYBOOK[normalizedType] || LEGAL_PLAYBOOK['other'];
      if (playbookMatch && Array.isArray(playbookMatch.guidelines) && playbookMatch.guidelines.length > 0) {
        console.log(`[RAG-Retriever] Local playbook fallback activated for type: "${normalizedType}".`);
        finalResults = playbookMatch.guidelines.slice(0, limit);
      }
    } catch (err) {
      console.error(`❌ [RAG-Retriever] Critical failure loading static legal playbook: ${err.message}`);
    }
  }

  // Save to cache before returning
  setCache(cacheKey, finalResults);

  return finalResults;
}

module.exports = {
  retrieveRelevantLaws,
};
