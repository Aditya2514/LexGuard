const graphDriver = require('./graphDriver');
const lawRetrieverService = require('./lawRetrieverService');

class GraphRagService {
  /**
   * Sanitizes alphanumeric codes to completely nuke Cypher injection vectors
   */
  sanitizeIdentifier(input) {
    if (typeof input !== 'string') return '';
    // Retain clean section labels and numbers (e.g., "27", "Exception 1", "ICA")
    return input.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
  }

  async retrieveAugmentedContext(contractCategory, clauseType, clauseText, jurisdiction, municipality = '', executionDate = null, logger = null) {
    // Step 1: Use the existing high-accuracy Vector Search to find the primary entry point
    const vectorHits = await lawRetrieverService.retrieveComplianceContext(
        contractCategory,
        clauseType,
        clauseText,
        jurisdiction,
        municipality,
        executionDate
    );

    if (!vectorHits || vectorHits.length === 0 || vectorHits === 'No specific statutory framework mapped.') return '';
    if (vectorHits.startsWith('Fallback Notice:')) return vectorHits; // Pass through fallback messages
    
    let augmentedContextStr = `=== GRAPH RAG COMPLIANCE CONTEXT ===\n\n`;
    augmentedContextStr += vectorHits + '\n\n';

    // Parse the Act and Section from the vector hits string
    const regex = /AUTHORITATIVE STATUTE:\s(.*?)\s-\sSection\s(.*?)\s?(?:\(Chunk|\n|$)/g;
    let match;
    const targets = [];
    while ((match = regex.exec(vectorHits)) !== null) {
      targets.push({ 
        act: this.sanitizeIdentifier(match[1]), 
        section: this.sanitizeIdentifier(match[2]) 
      });
    }

    if (targets.length === 0) return vectorHits;

    for (const target of targets.slice(0, 2)) { // Limit graph traversal to top 2 primary hits
      const cypherQuery = `
        MATCH (s:Statute)
        WHERE s.act CONTAINS $act AND s.section CONTAINS $section
        OPTIONAL MATCH (s)-[r:EXCEPTS|DEFINED_BY]->(dependency:Statute)
        OPTIONAL MATCH (precedent:Precedent)-[r2:STARE_DECISIS]->(s)
        RETURN 
          collect(DISTINCT { type: type(r), act: dependency.act, section: dependency.section }) AS dependencies,
          collect(DISTINCT { type: type(r2), caseName: precedent.caseName, citation: precedent.citation }) AS precedents
      `;

      let retries = 2;
      let delay = 300; // ms
      let success = false;

      while (retries >= 0 && !success) {
        try {
          const result = await graphDriver.read(cypherQuery, { act: target.act, section: target.section });
          
          if (logger) {
            const edgeCount = (result.records[0]?.get('dependencies')?.length || 0) + 
                              (result.records[0]?.get('precedents')?.length || 0);
            logger.logGraphTraversal(edgeCount, false);
          }

          if (result.records.length > 0) {
              const record = result.records[0];
              const dependencies = record.get('dependencies') || [];
              const precedents = record.get('precedents') || [];

              if (dependencies.length > 0) {
                 augmentedContextStr += `[Structural Dependencies for ${target.section}]:\n`;
                 for (const d of dependencies) {
                    if (d.act) {
                       augmentedContextStr += `> ${d.type} -> ${d.act}, ${d.section}\n`;
                    }
                 }
                 augmentedContextStr += `\n`;
              }

              if (precedents.length > 0) {
                 augmentedContextStr += `[Binding Precedents for ${target.section}]:\n`;
                 for (const p of precedents) {
                    if (p.caseName) {
                       augmentedContextStr += `> ${p.caseName} (${p.citation})\n`;
                    }
                 }
                 augmentedContextStr += `\n`;
              }
          }
          success = true;

        } catch (error) {
          console.warn(`⚠️ [GraphRAG] Neo4j error encountered for ${target.act} ${target.section}. Retries remaining: ${retries}. Error: ${error.message}`);
          
          if (retries === 0) {
            console.error("🚨 Circuit Breaker Tripped: Routing directly to Flat Vector Fallback.");
            if (logger) logger.logGraphTraversal(0, true);
            
            // GRACEFUL FALLBACK: Return the standard vector hits unmodified
            return vectorHits;
          }

          // Linear backoff delay
          await new Promise(resolve => setTimeout(resolve, delay));
          retries--;
          delay *= 2; 
        }
      }
    }

    return augmentedContextStr;
  }
}

module.exports = new GraphRagService();
