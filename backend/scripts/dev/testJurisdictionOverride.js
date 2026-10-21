require('dotenv').config();
const mongoose = require('mongoose');
const Contract = require('./src/models/Contract');
const Clause = require('./src/models/Clause');
const { enforceJurisdictionOverrides } = require('./src/services/jurisdictionOverrideService');

async function testJurisdictionOverride() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Create a dummy contract with New York governing law but a California employee
        const dummyContract = await Contract.create({
            userId: new mongoose.Types.ObjectId(),
            originalFileName: 'test_california_override.pdf',
            contractCategory: 'employment',
            status: 'processing',
            globalContext: {
                metadata: {
                    governingLaw: 'State of New York',
                    employeeAddress: 'San Francisco, California, USA',
                    companyAddress: 'New York City, NY, USA'
                },
                globalDefinitions: {}
            }
        });

        // 2. Create a dummy non-compete clause that the LLM theoretically rated "LOW" 
        // because it thought New York law allowed it.
        const dummyClause = await Clause.create({
            contractId: dummyContract._id,
            segmentIndex: 1,
            rawText: "The Employee shall not engage in any competing business for a period of 12 months after termination.",
            clause_type: "non_compete",
            risk_level: "low",
            risk_score: 2,
            risk_reasons: ["LLM thought this was fine under New York law."],
            possible_law_references: []
        });

        console.log(`\n📄 Created Dummy Contract: ${dummyContract._id}`);
        console.log(`Pre-Override Risk Level: ${dummyClause.risk_level.toUpperCase()} (Score: ${dummyClause.risk_score})`);

        // 3. Fire the Override Service
        console.log(`\n🚀 Firing Jurisdiction Override Service...`);
        await enforceJurisdictionOverrides(dummyContract._id);

        // 4. Fetch the mutated clause
        const overriddenClause = await Clause.findById(dummyClause._id).lean();

        console.log('\n======================================================');
        console.log('🤖 FINAL CLAUSE STATE:');
        console.log('======================================================');
        console.log(`New Risk Level: ${overriddenClause.risk_level.toUpperCase()} (Score: ${overriddenClause.risk_score})`);
        console.log('Risk Reasons:');
        console.log(JSON.stringify(overriddenClause.risk_reasons, null, 2));

    } catch (err) {
        console.error('❌ Test failed:', err);
    } finally {
        mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

testJurisdictionOverride();
