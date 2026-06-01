require('dotenv').config();
const mongoose = require('mongoose');
const CaseLaw = require('../src/models/CaseLaw');
const { generateEmbedding } = require('../src/services/embeddingService');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lexguard";

const LANDMARK_CASES = [
    {
        case_title: "Percept D'Mark (India) Pvt. Ltd. v. Zaheer Khan and Anr.",
        citation: "(2006) 4 SCC 227",
        legal_domain: "labor_law",
        summary: "The Supreme Court of India categorically held that under Section 27 of the Indian Contract Act, a restrictive covenant extending beyond the term of the contract is void and not enforceable. The doctrine of restraint of trade does not apply during the continuance of the contract, but explicitly applies post-employment or post-contract. Any post-termination non-compete is void, regardless of reasonableness."
    }
];

async function seedLandmarkCases() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log(`✅ Connected to DB: ${MONGODB_URI}`);

        for (const caseData of LANDMARK_CASES) {
            // Generate 1024-d embedding
            const embedding = await generateEmbedding(caseData.summary, 'search_document');
            
            if (!embedding || embedding.length !== 1024) {
                throw new Error(`Failed to generate 1024-d embedding for ${caseData.case_title}`);
            }

            // Check if exists
            const exists = await CaseLaw.findOne({ case_title: caseData.case_title });
            if (exists) {
                console.log(`⚠️ Case Law already exists: ${caseData.case_title}. Overwriting...`);
                await CaseLaw.deleteOne({ _id: exists._id });
            }

            const newCase = new CaseLaw({
                ...caseData,
                embedding
            });

            await newCase.save();
            console.log(`✅ Successfully injected Supreme Court Precedent: ${caseData.case_title}`);
        }
        
    } catch (error) {
        console.error('🚨 Seeding Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from DB.');
    }
}

seedLandmarkCases();
