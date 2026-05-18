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
 * Triple-Layered Legal Law Retriever with LRU In-Memory Cache
 * 
 * Retrieves relevant legal bare acts/rules using a dynamic fallback hierarchy:
 * 1. Tier 1: Dynamic MongoDB full-text index matching (retrieval-augmented).
 * 2. Tier 2: Static local rules playbook matching keyed by clause_type (zero-latency, fail-safe fallback).
 * 3. Tier 3: Safe empty array fallback.
 * 
 * @param {string} clauseText - raw text of the clause
 * @param {string} clauseType - categorized clause type (e.g. 'non_compete')
 * @param {number} limit - maximum number of references to return
 * @returns {Promise<Array<Object>>} array of structured legal guidelines
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

  // Tier 1: Try Dynamic MongoDB Full-Text & Keyword Hybrid Query
  try {
    // Check if MongoDB connection is open/ready
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
        console.log(`[RAG-Retriever] Dynamic match successful! Found ${finalMatches.length} references in MongoDB.`);
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
    console.warn(`⚠️ [RAG-Retriever] Dynamic search failed: ${err.message}. Cascading to Tier 2 (Static Playbook)...`);
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
