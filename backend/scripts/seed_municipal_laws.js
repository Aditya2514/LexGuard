require('dotenv').config();
const mongoose = require('mongoose');
const StatuteNode = require('../src/models/StatuteNode');
const { generateEmbedding } = require('../src/services/embeddingService');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lexguard";

const BBMP_ZONING_BYLAW = {
    actName: "BBMP Zoning Regulations (RMP 2015/2031)",
    sectionNumber: "Section 4.1 (Residential Zones)",
    content: "Under BBMP commercial zoning regulations, IT and software development activities exceeding 10 employees are strictly prohibited in residential zones without a localized commercial change-of-use permit.",
    domain: "real_estate_law",
    jurisdiction: "BBMP",
    isRepealed: false
};

async function seedMunicipalLaws() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log(`✅ Connected to DB: ${MONGODB_URI}`);

        // Generate embedding
        const embedding = await generateEmbedding(BBMP_ZONING_BYLAW.content, 'search_document');
        
        if (!embedding || embedding.length !== 1024) {
            throw new Error(`Failed to generate 1024-d embedding. Got length: ${embedding ? embedding.length : 'null'}`);
        }

        // Check if exists
        const exists = await StatuteNode.findOne({ actName: BBMP_ZONING_BYLAW.actName, sectionNumber: BBMP_ZONING_BYLAW.sectionNumber });
        if (exists) {
            console.log("⚠️ BBMP Zoning Bylaw already exists. Overwriting...");
            await StatuteNode.deleteOne({ _id: exists._id });
        }

        const node = new StatuteNode({
            ...BBMP_ZONING_BYLAW,
            embedding
        });

        await node.save();
        console.log(`✅ Successfully injected adversarial BBMP zoning bylaw!`);
    } catch (error) {
        console.error('🚨 Seeding Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from DB.');
    }
}

seedMunicipalLaws();
