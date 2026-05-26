const LegalDomainMap = require('../models/LegalDomainMap');
const { generateEmbedding } = require('./embeddingService'); // Pre-existing service
const mongoose = require('mongoose');
const StatuteNode = require('../models/StatuteNode');

/**
 * Dynamically retrieves relevant Indian Statutory Sections based on contract ontology and semantics
 */
async function retrieveComplianceContext(contractType, clauseType, clauseText, jurisdiction = "Central") {
  try {
    // 1. Fetch the exact statutory routing domains for this specific intersection
    const mapping = await LegalDomainMap.findOne({ contractType, clauseType });
    const activeDomains = mapping ? mapping.targetDomains : ["general_contract_law", "real_estate_law", "labor_law", "data_privacy"];

    console.log(`⚖️ [Ontology Router] Mapping [${contractType} ➔ ${clauseType}] to Domains:`, activeDomains);

    // 2. Generate the 384-dimensional dense vector for the target clause wording
    const queryVector = await generateEmbedding(clauseText);

    // 3. Use the imported StatuteNode model (avoids OverwriteModelError on concurrent calls)

    // 4. Run native Atlas Vector Search with metadata domain filters
    const statutoryMatches = await StatuteNode.aggregate([
      {
        $vectorSearch: {
          index: "lexguard_statutes_vector_index", // Index registered in Atlas
          path: "embedding",
          queryVector: queryVector,
          numCandidates: 30,
          limit: 3,
          filter: { 
            domain: { $in: activeDomains },
            jurisdiction: { $in: ["Central", jurisdiction] }
          } // Strict compliance scoping: zero contamination, scoped to jurisdiction + Central
        }
      },
      {
        $project: {
          actName: 1,
          sectionNumber: 1,
          content: 1,
          domain: 1,
          similarityScore: { $meta: "vectorSearchScore" }
        }
      }
    ]);

    const RELEVANCE_THRESHOLD = 0.70;
    const relevantMatches = statutoryMatches.filter(match => match.similarityScore >= RELEVANCE_THRESHOLD);

    if (relevantMatches.length === 0) {
      return "No specific statutory framework mapped.";
    }

    // 5. Format results into structured prompt blocks
    return relevantMatches.map(match => (
      `AUTHORITATIVE STATUTE: ${match.actName} - Section ${match.sectionNumber}\nStatutory Provision Text: ${match.content}\n[Domain Context: ${match.domain}]`
    )).join('\n\n');

  } catch (error) {
    console.error("🚨 [Dynamic Retriever Failure]:", error.message);
    return "Fallback Notice: Ingestion engine failed to dynamically scale context window parameters.";
  }
}

module.exports = { retrieveComplianceContext, getEmbedding: generateEmbedding };
