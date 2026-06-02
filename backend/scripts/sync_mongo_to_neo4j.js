require('dotenv').config();
const mongoose = require('mongoose');
const StatuteNode = require('../src/models/StatuteNode');
const CaseLaw = require('../src/models/CaseLaw');
const graphDriver = require('../src/services/graphDriver');

async function syncMongoToNeo4j() {
  console.log('🔄 Starting MongoDB to Neo4j synchronization...');

  // Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing nodes (optional, but good for fresh syncs)
  console.log('🗑️ Clearing existing Neo4j graph...');
  await graphDriver.write('MATCH (n) DETACH DELETE n');

  // Sync StatuteNodes
  console.log('📚 Syncing Statutes...');
  const statutes = await StatuteNode.find({}).lean();
  for (let i = 0; i < statutes.length; i += 100) {
    const batch = statutes.slice(i, i + 100);
    const cypher = `
      UNWIND $batch AS s
      MERGE (n:Statute {id: s._id})
      SET n.act = s.actName,
          n.section = s.sectionNumber,
          n.jurisdiction = s.jurisdiction,
          n.domain = s.domain
    `;
    await graphDriver.write(cypher, {
      batch: batch.map(s => ({
        _id: s._id.toString(),
        actName: s.actName,
        sectionNumber: s.sectionNumber,
        jurisdiction: s.jurisdiction,
        domain: s.domain
      }))
    });
    console.log(`✅ Synced Statutes ${i} to ${Math.min(i + 100, statutes.length)}`);
  }

  // Sync CaseLaws
  console.log('⚖️ Syncing Case Laws...');
  const cases = await CaseLaw.find({}).lean();
  for (let i = 0; i < cases.length; i += 100) {
    const batch = cases.slice(i, i + 100);
    const cypher = `
      UNWIND $batch AS c
      MERGE (n:Precedent {id: c._id})
      SET n.caseName = c.case_title,
          n.citation = c.citation,
          n.domain = c.legal_domain
    `;
    await graphDriver.write(cypher, {
      batch: batch.map(c => ({
        _id: c._id.toString(),
        case_title: c.case_title,
        citation: c.citation,
        legal_domain: c.legal_domain
      }))
    });
    console.log(`✅ Synced Case Laws ${i} to ${Math.min(i + 100, cases.length)}`);
  }

  console.log('🎉 Synchronization complete!');
  
  // Close connections
  await mongoose.connection.close();
  await graphDriver.close();
}

syncMongoToNeo4j().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
