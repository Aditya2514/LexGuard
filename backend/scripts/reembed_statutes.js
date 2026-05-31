require('dotenv').config();
const mongoose = require('mongoose');
const StatuteNode = require('../src/models/StatuteNode');
const CaseLaw = require('../src/models/CaseLaw');
const { generateEmbedding } = require('../src/services/embeddingService');

async function reembedAll() {
    console.log("🚀 Connecting to MongoDB for Re-embedding Statutes and Case Laws...");
    await mongoose.connect(process.env.MONGODB_URI);

    const BATCH_SIZE = 50;
    const totalCount = await StatuteNode.countDocuments();
    let processed = 0;

    console.log(`Found ${totalCount} statutes to re-embed. Starting...`);

    const cursor = StatuteNode.find().cursor({ batchSize: BATCH_SIZE });
    
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        try {
            // Re-embed using taskType = 'search_document'
            const vector = await generateEmbedding(doc.content, 'search_document');
            
            if (vector && vector.length === 768) {
                await StatuteNode.updateOne(
                    { _id: doc._id },
                    { $set: { embedding: vector } }
                );
            } else {
                console.warn(`⚠️ Vector length is not 768 for statute ${doc._id}. (Got ${vector?.length}). Skipped.`);
            }
        } catch (err) {
            console.error(`🚨 Error re-embedding statute ${doc._id}: ${err.message}`);
        }
        
        processed++;
        if (processed % BATCH_SIZE === 0) {
            console.log(`Processed ${processed} / ${totalCount} statutes...`);
        }
    }

    console.log(`✅ Finished re-embedding ${processed} statutes.`);
    
    const caseLawCount = await CaseLaw.countDocuments();
    if (caseLawCount > 0) {
        console.log(`\nFound ${caseLawCount} Case Laws to re-embed. Starting...`);
        let clProcessed = 0;
        const clCursor = CaseLaw.find().cursor({ batchSize: BATCH_SIZE });
        for (let doc = await clCursor.next(); doc != null; doc = await clCursor.next()) {
            try {
                const vector = await generateEmbedding(doc.summary, 'search_document');
                if (vector && vector.length === 768) {
                    await CaseLaw.updateOne(
                        { _id: doc._id },
                        { $set: { embedding: vector } }
                    );
                } else {
                    console.warn(`⚠️ Vector length is not 768 for CaseLaw ${doc._id}. Skipped.`);
                }
            } catch (err) {
                console.error(`🚨 Error re-embedding CaseLaw ${doc._id}: ${err.message}`);
            }
            clProcessed++;
            if (clProcessed % BATCH_SIZE === 0) {
                console.log(`Processed ${clProcessed} / ${caseLawCount} Case Laws...`);
            }
        }
        console.log(`✅ Finished re-embedding ${clProcessed} Case Laws.`);
    }

    console.log("\n⚠️ MANUAL STEP REQUIRED ⚠️");
    console.log("Go to Atlas Search -> Vector Search JSON Editor and change lexguard_statutes_vector_index dimensions to 768.");

    process.exit(0);
}

reembedAll();
