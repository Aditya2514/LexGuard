require('dotenv').config();
const mongoose = require('mongoose');
const StatuteNode = require('../src/models/StatuteNode');
const CaseLaw = require('../src/models/CaseLaw');
const graphDriver = require('../src/services/graphDriver');
const { callLLM } = require('../src/services/aiClient');

const SYSTEM_PROMPT = `You are an expert legal Knowledge Graph extractor.
Your job is to read a legal provision or case summary and identify explicit structural relationships to other laws or cases.
Output a JSON object with a "triples" array. Each triple must have:
- source_type (Statute or Precedent)
- source_id (The _id of the text you are analyzing)
- relation (MUST BE one of: EXCEPTS, DEFINED_BY, STARE_DECISIS)
- target_type (Statute or Precedent)
- target_hint (The name/section of the target, e.g. "Section 27", "Zaheer Khan")

Focus ONLY on explicit exceptions, definitions, and precedents mentioned in the text.
Return JSON ONLY.`;

async function seedLegalEdges() {
  console.log('🌱 Starting Edge Seeding Pipeline...');
  
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const statutes = await StatuteNode.find({}).lean().limit(50); // Limit to 50 for this demo execution
  
  let totalEdges = 0;

  for (const s of statutes) {
    console.log(`Analyzing: ${s.actName} - ${s.sectionNumber}...`);
    
    const userContent = JSON.stringify({
      source_id: s._id.toString(),
      text: s.content
    });

    try {
      const response = await callLLM({
        systemPrompt: SYSTEM_PROMPT,
        userContent: userContent,
        jsonMode: true,
        maxTokens: 500
      });

      const triples = response.triples || [];
      
      for (const t of triples) {
        // Build the cypher query to link them
        // In a full production script, we'd do a fuzzy match in MongoDB to find the target's actual _id.
        // For Phase 19 implementation, we will map string attributes in Neo4j directly or use MERGE for unresolved targets.
        
        let cypher = '';
        if (t.relation === 'EXCEPTS' || t.relation === 'DEFINED_BY') {
           cypher = `
             MATCH (source:Statute {id: $sourceId})
             MERGE (target:Statute {section: $targetHint})
             MERGE (source)-[r:${t.relation}]->(target)
             RETURN r
           `;
        } else if (t.relation === 'STARE_DECISIS') {
           cypher = `
             MATCH (source:Statute {id: $sourceId})
             MERGE (target:Precedent {caseName: $targetHint})
             MERGE (target)-[r:STARE_DECISIS]->(source)
             RETURN r
           `;
        }

        if (cypher) {
           await graphDriver.write(cypher, { 
             sourceId: s._id.toString(),
             targetHint: t.target_hint 
           });
           totalEdges++;
           console.log(`   🔗 Created edge: ${s.sectionNumber} -[${t.relation}]-> ${t.target_hint}`);
        }
      }
    } catch (err) {
      console.warn(`   ⚠️ Failed to extract edges for ${s.sectionNumber}: ${err.message}`);
    }
  }

  console.log(`🎉 Edge Seeding Complete! Extracted and committed ${totalEdges} relationships to Neo4j.`);

  await mongoose.connection.close();
  await graphDriver.close();
}

seedLegalEdges().catch(err => {
  console.error('❌ Edge seeding failed:', err);
  process.exit(1);
});
