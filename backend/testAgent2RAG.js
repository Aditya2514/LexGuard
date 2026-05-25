require('dotenv').config();
const mongoose = require('mongoose');
const { runAgent2RiskAnalyst } = require('./src/services/agent2RiskAnalyst');

async function testAgent2WithCaseLaw() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Create a dummy clause for the test
        const clausesBatch = [
            {
                id: 'dummy_clause_123',
                segmentIndex: 1,
                text: "The Employee agrees that for a period of 24 months following the termination of this Agreement, they shall not directly or indirectly engage in any business that competes with the Company.",
                clause_type: "non_compete"
            }
        ];

        console.log(`\n🚀 Firing Agent 2 Risk Analyst (with Case Law Injection)...`);
        
        // Expose the internals by overriding the export temporarily or just running the function
        const results = await runAgent2RiskAnalyst(clausesBatch, { 
            metadata: { governingLaw: "Indian Law" }, 
            globalDefinitions: {} 
        });

        console.log('\n======================================================');
        console.log('🤖 AGENT 2 ANALYSIS RESULT:');
        console.log('======================================================');
        console.log(JSON.stringify(results, null, 2));

    } catch (err) {
        console.error('❌ Test failed:', err);
    } finally {
        mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

testAgent2WithCaseLaw();
