const graphDriver = require('./graphDriver');
const lawRetrieverService = require('./lawRetrieverService');

class GraphRagService {
  /**
   * Retrieves compliance context augmented by the Neo4j Knowledge Graph.
   */
  async retrieveAugmentedContext(contractCategory, clauseType, clauseText, jurisdiction, municipality = '', executionDate = null) {
    // Step 1: Use the existing high-accuracy Vector Search to find the primary entry point
    const vectorHits = await lawRetrieverService.retrieveComplianceContext(
        contractCategory,
        clauseType,
        clauseText,
        jurisdiction,
        municipality,
        executionDate
    );

    if (!vectorHits || vectorHits.length === 0) return '';
    
    let augmentedContextStr = `=== GRAPH RAG COMPLIANCE CONTEXT ===\n\n`;
    augmentedContextStr += vectorHits + '\n\n';

    // Parse the Act and Section from the vector hits string
    const regex = /AUTHORITATIVE STATUTE:\s(.*?)\s-\sSection\s(.*?)\s?(?:\(Chunk|\n|$)/g;
    let match;
    const targets = [];
    while ((match = regex.exec(vectorHits)) !== null) {
      targets.push({ act: match[1].trim(), section: match[2].trim() });
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

      try {
        const result = await graphDriver.read(cypherQuery, { act: target.act, section: target.section });
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
      } catch (err) {
        console.warn(`[GraphRAG] Neo4j traversal failed for ${target.act} ${target.section}: ${err.message}`);
      }
    }

    return augmentedContextStr;
  }
}

module.exports = new GraphRagService();
