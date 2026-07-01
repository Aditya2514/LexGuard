const LegalDomainMap = require('../models/LegalDomainMap');
const { generateEmbedding } = require('./embeddingService'); // Pre-existing service
const mongoose = require('mongoose');
const StatuteNode = require('../models/StatuteNode');

/**
 * Dynamically retrieves relevant Indian Statutory Sections based on contract ontology and semantics
 */
async function retrieveComplianceContext(contractType, clauseType, clauseText, jurisdiction = "Central", municipality = null, executionDate = null) {
  try {
    // 1. Fetch the exact statutory routing domains for this specific intersection
    const mapping = await LegalDomainMap.findOne({ contractType, clauseType });
    
    const CLAUSE_TYPE_DOMAIN_FALLBACK = {
      'non_compete': ['labor_law', 'general_contract_law'],
      'non_solicitation': ['labor_law', 'general_contract_law'],
      'compensation': ['labor_law', 'general_contract_law'],
      'termination': ['labor_law', 'general_contract_law'],
      'privacy_data': ['data_privacy', 'general_contract_law'],
      'delivery_possession': ['real_estate_law', 'general_contract_law'],
      'ip_assignment': ['intellectual_property', 'general_contract_law'],
      'intellectual_property': ['intellectual_property', 'general_contract_law'],
      'dispute_resolution': ['dispute_resolution', 'general_contract_law'],
      'governing_law': ['dispute_resolution', 'general_contract_law'],
      'confidentiality': ['labor_law', 'data_privacy'],
      'indemnification': ['general_contract_law'],
      'liability_limit': ['general_contract_law', 'consumer_protection'],
      'auto_renewal': ['general_contract_law', 'consumer_protection'],
      'amendment': ['general_contract_law', 'labor_law'],
      'warranty': ['general_contract_law', 'consumer_protection'],
      'force_majeure': ['general_contract_law'],
      'disclosure': ['real_estate_law', 'general_contract_law'],
      'timeline_performance': ['real_estate_law', 'general_contract_law'],
      'licensing': ['intellectual_property', 'general_contract_law'],
      'other': ['general_contract_law']
    };
    
    let activeDomains = mapping ? mapping.targetDomains : (CLAUSE_TYPE_DOMAIN_FALLBACK[clauseType] || ['general_contract_law']);
    
    // Clean up domains for non-employment contracts to avoid labor law bleed
    if (contractType !== 'employment') {
      activeDomains = activeDomains.filter(domain => domain !== 'labor_law');
    }

    // Safety guard: if all domains were filtered out, fall back to general contract law
    // to prevent an empty $in query that would return zero results from the vector search
    if (activeDomains.length === 0) {
      activeDomains = ['general_contract_law'];
      console.warn(`⚠️ [Ontology Router] All domains were filtered for [${contractType} → ${clauseType}]. Falling back to general_contract_law.`);
    }

    console.log(`⚖️ [Ontology Router] Mapping [${contractType} ➔ ${clauseType}] to Domains:`, activeDomains);

    // 2. Generate the 1024-dimensional dense vector for the target clause wording
    let queryVector;
    if (Array.isArray(clauseText)) {
      queryVector = clauseText;
    } else {
      queryVector = await generateEmbedding(clauseText, 'search_query');
    }

    // 3. Use the imported StatuteNode model (avoids OverwriteModelError on concurrent calls)

    // Build filter based on executionDate
    const vectorFilter = {
        domain: { $in: activeDomains },
        jurisdiction: { $in: ["Central", jurisdiction, municipality].filter(Boolean) }
    };
    
    // If contract was executed before July 1, 2024, don't filter out repealed laws (IPC/CrPC still apply)
    // If no execution date or after July 1, 2024, filter out repealed laws
    const cutoffDate = new Date('2024-07-01');
    const execDate = executionDate ? new Date(executionDate) : new Date();
    
    const matchFilter = {};
    if (execDate >= cutoffDate) {
        matchFilter.isRepealed = { $ne: true };
    }

    // 4. Run native Atlas Vector Search with metadata domain filters
    const statutoryMatches = await StatuteNode.aggregate([
      {
        $vectorSearch: {
          index: "lexguard_statutes_vector_index", // Index registered in Atlas
          path: "embedding",
          queryVector: queryVector,
          numCandidates: 100,
          limit: 20,
          filter: vectorFilter // Use indexed fields here for efficiency
        }
      },
      {
        $match: matchFilter // Use unindexed fields here
      },
      {
        $limit: 5
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

    const RELEVANCE_THRESHOLD = 0.60;
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
