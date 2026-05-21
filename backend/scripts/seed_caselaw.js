require('dotenv').config();
const mongoose = require('mongoose');
const { getEmbedding } = require('../src/services/lawRetrieverService');
const { upsertCaseLaw } = require('../src/services/pineconeClient');
const CaseLaw = require('../src/models/CaseLaw');

const landmarkCases = [
  {
    caseName: 'Niranjan Shankar Golikari vs Century Spinning And Mfg. Co.',
    citation: '1967 AIR 1098, 1967 SCR (2) 378',
    court: 'Supreme Court of India',
    summary: 'A landmark judgment distinguishing between negative covenants during the term of employment and post-employment under Section 27 of the Indian Contract Act. The court held that non-compete clauses operating during the period of employment are generally valid, whereas those operating post-termination are void as a restraint of trade.',
    holdings: [
      'Negative covenants operative during the period of the contract of employment are generally not regarded as restraint of trade.',
      'Post-employment non-compete restrictions are void under Section 27 of the Contract Act.',
    ],
    referenceUrl: 'https://indiankanoon.org/doc/1342674/'
  },
  {
    caseName: 'Percept D\'Mark (India) Pvt. Ltd vs Zaheer Khan & Anr',
    citation: '2006 (4) SCC 227',
    court: 'Supreme Court of India',
    summary: 'Reaffirmed that under Section 27 of the Contract Act, a restrictive covenant extending beyond the term of the contract is void and not enforceable. The right to livelihood is paramount.',
    holdings: [
      'A restrictive covenant extending beyond the term of the contract is void under Section 27.',
      'The doctrine of restraint of trade does not apply during the continuance of the contract of employment.'
    ],
    referenceUrl: 'https://indiankanoon.org/doc/1638204/'
  }
];

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Processing landmark cases...');
    
    for (const caseData of landmarkCases) {
      console.log(`Embedding case: ${caseData.caseName}`);
      const textToEmbed = `${caseData.caseName} ${caseData.summary} ${caseData.holdings.join(' ')}`;
      
      const vector = await getEmbedding(textToEmbed);
      
      // Generate a deterministic ID for pinecone based on citation
      const pineconeId = `caselaw_${caseData.citation.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Upsert to MongoDB
      let cl = await CaseLaw.findOne({ citation: caseData.citation });
      if (!cl) {
        cl = new CaseLaw({
          ...caseData,
          pineconeId
        });
        await cl.save();
        console.log(`[MongoDB] Inserted ${caseData.caseName}`);
      } else {
        console.log(`[MongoDB] Case ${caseData.caseName} already exists`);
      }

      // Upsert to Pinecone
      console.log(`[Pinecone] Upserting vector for ${caseData.caseName}... (Vector length: ${vector ? vector.length : 'undefined'})`);
      await upsertCaseLaw(pineconeId, vector, {
        caseName: caseData.caseName,
        citation: caseData.citation,
        court: caseData.court,
        summary: caseData.summary,
        holdings: JSON.stringify(caseData.holdings),
        referenceUrl: caseData.referenceUrl
      });
    }

    console.log('✅ Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
