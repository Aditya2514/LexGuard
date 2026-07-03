const LegalDomainMap = require('../models/LegalDomainMap');
const { generateEmbedding } = require('./embeddingService');
const mongoose = require('mongoose');
const StatuteNode = require('../models/StatuteNode');

/**
 * Helper to compute Compliance Confidence Score and Tag based on Vector Similarity
 */
function getComplianceConfidence(similarityScore) {
  const scorePercent = Math.min(100, Math.max(0, Math.round(similarityScore * 100)));
  let tag = 'Low Confidence / Requires Review';
  if (similarityScore >= 0.80) {
    tag = 'High Confidence';
  } else if (similarityScore >= 0.70) {
    tag = 'Medium Confidence';
  }
  return { confidenceScore: scorePercent, confidenceTag: tag };
}

/**
 * Dynamically retrieves relevant Indian Statutory Sections based on contract ontology and semantics
 */
async function retrieveComplianceContext(contractType, clauseType, clauseText, jurisdiction = "Central", municipality = null, executionDate = null) {
  try {
    // Preamble / Title / Witness Signature Gate: Skip statutory vector search for introductory boilerplate
    const textSample = typeof clauseText === 'string' ? clauseText.toLowerCase() : '';
    const isPreambleOrSignature = clauseType === 'preamble' || clauseType === 'title' || clauseType === 'parties' ||
      textSample.includes('this master services agreement') || textSample.includes('this agreement is entered into') ||
      textSample.includes('in witness whereof') || (textSample.startsWith('master services agreement') && textSample.length < 200);

    if (isPreambleOrSignature) {
      console.log(`⚖️ [Ontology Router] Skipping statutory vector search for introductory header.`);
      return "No specific statutory framework mapped.";
    }

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
      'dispute_resolution': ['dispute_resolution'],
      'governing_law': ['dispute_resolution'],
      'confidentiality': ['data_privacy'],
      'indemnification': ['general_contract_law'],
      'liability_limit': ['general_contract_law', 'consumer_protection'],
      'auto_renewal': ['general_contract_law', 'consumer_protection'],
      'amendment': ['general_contract_law'],
      'warranty': ['general_contract_law', 'consumer_protection'],
      'force_majeure': ['general_contract_law'],
      'disclosure': ['real_estate_law', 'general_contract_law'],
      'timeline_performance': ['general_contract_law'],
      'licensing': ['intellectual_property', 'general_contract_law'],
      'other': ['general_contract_law']
    };
    
    let activeDomains = mapping ? mapping.targetDomains : (CLAUSE_TYPE_DOMAIN_FALLBACK[clauseType] || ['general_contract_law']);
    
    // Clean up domains for non-employment contracts to avoid labor law bleed
    if (contractType !== 'employment') {
      activeDomains = activeDomains.filter(domain => domain !== 'labor_law');
    }

    // Safety guard
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

    // 3. Build filter
    const vectorFilter = {
        domain: { $in: activeDomains },
        jurisdiction: { $in: ["Central", jurisdiction, municipality].filter(Boolean) }
    };
    
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
          index: "lexguard_statutes_vector_index",
          path: "embedding",
          queryVector: queryVector,
          numCandidates: 100,
          limit: 20,
          filter: vectorFilter
        }
      },
      {
        $match: matchFilter
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

    // Elevated Relevance Cutoff: 0.70 to eliminate misattributed/tenuous statutory matches
    const RELEVANCE_THRESHOLD = 0.70;
    const lowerClauseText = typeof clauseText === 'string' ? clauseText.toLowerCase() : '';
    
    const financialTerms = ['cheque', 'promissory', 'bill of exchange', 'negotiable', 'bank', 'escrow', 'trade', 'execution price', 'fund', 'managing director', 'share capital'];
    const hasFinancialContext = financialTerms.some(term => lowerClauseText.includes(term));

    const relevantMatches = statutoryMatches
      .filter(match => {
        if (match.similarityScore < RELEVANCE_THRESHOLD) return false;
        
        // Strict domain safety: reject Negotiable Instruments / Banking / Corporate MD acts unless clause text is explicitly financial
        const actLower = (match.actName || '').toLowerCase();
        const isFinancialAct = actLower.includes('negotiable instruments') || actLower.includes('banking regulation') || (actLower.includes('companies act') && match.sectionNumber === '190');
        if (isFinancialAct && !hasFinancialContext) {
          console.log(`⚖️ [Retriever Safety Filter] Rejection: Act '${match.actName}' (Sec ${match.sectionNumber}) does not match non-financial clause text.`);
          return false;
        }

        // Strict restraint safety: Section 27 (Indian Contract Act - Restraint of Trade) is ONLY allowed if clause text explicitly contains restraint keywords
        const isSection27 = (match.sectionNumber === '27' || (match.content && match.content.includes('restraint of trade')));
        const restraintTerms = ['non-compete', 'non compete', 'restricted period', 'restraint of trade', 'shall not engage', 'compete with', '60-month', '60 month', 'post-termination competition'];
        const hasRestraintKeywords = restraintTerms.some(term => lowerClauseText.includes(term));
        if (isSection27 && !hasRestraintKeywords) {
          console.log(`⚖️ [Retriever Safety Filter] Rejection: Section 27 (Restraint of Trade) rejected on non-restraint clause.`);
          return false;
        }

        return true;
      })
      .map(match => {
        const { confidenceScore, confidenceTag } = getComplianceConfidence(match.similarityScore);
        return {
          ...match,
          confidenceScore,
          confidenceTag,
          compliance_confidence_score: confidenceScore,
          compliance_confidence_tag: confidenceTag
        };
      });

    if (relevantMatches.length === 0) {
      return "No specific statutory framework mapped.";
    }

    // 5. Format results into structured prompt blocks with Compliance Confidence Tags
    return relevantMatches.map(match => (
      `AUTHORITATIVE STATUTE: ${match.actName} - Section ${match.sectionNumber}\n` +
      `[Compliance Confidence: ${match.confidenceTag} (${match.confidenceScore}% Vector Match)]\n` +
      `Statutory Provision Text: ${match.content}\n` +
      `[Domain Context: ${match.domain}]`
    )).join('\n\n');

  } catch (error) {
    console.error("🚨 [Dynamic Retriever Failure]:", error.message);
    return "Fallback Notice: Ingestion engine failed to dynamically scale context window parameters.";
  }
}

module.exports = { 
  retrieveComplianceContext, 
  getEmbedding: generateEmbedding,
  getComplianceConfidence 
};
