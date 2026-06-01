const mongoose = require('mongoose');
const StatuteNode = require('../src/models/StatuteNode');
const embeddingService = require('../src/services/embeddingService');
require('dotenv').config({ path: '../.env' });

async function runMigration() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB. Starting BGE-m3 Migration...");

  // (Init is handled automatically by generateEmbedding)

  // 1. Migrate Statutes that still have 768 dimensions
  const filter = { embedding: { $size: 768 } };
  const totalStatutes = await StatuteNode.countDocuments(filter);
  console.log(`Found ${totalStatutes} Statutes to re-embed.`);
  
  let processed = 0;
  
  while (true) {
    const batch = await StatuteNode.find(filter).limit(100);
    if (batch.length === 0) break;
    
    for (let doc of batch) {
      try {
        // Generate the new 1024d vector from the existing text
        const newEmbedding = await embeddingService.generateEmbedding(doc.content);
        
        // Update the document in MongoDB
        doc.embedding = newEmbedding;
        await doc.save();
        
        processed++;
        if (processed % 100 === 0) {
          console.log(`Progress: ${processed} / ${totalStatutes} Statutes migrated...`);
        }
      } catch (err) {
        console.error(`Failed on Document ID: ${doc._id}`, err);
      }
    }
  }

  console.log("✅ Migration Complete! All vectors are now 1024-dimensional.");
  process.exit(0);
}

runMigration();
