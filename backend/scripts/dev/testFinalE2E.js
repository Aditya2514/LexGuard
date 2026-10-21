require('dotenv').config();
const mongoose = require('mongoose');
const Contract = require('./src/models/Contract');
const Clause = require('./src/models/Clause');
const { processContractJob } = require('./src/services/jobQueueService');

async function runFinalE2ETest() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Create a hyper-dense test document that triggers all 5 phases
        const mockContractText = `
        EMPLOYMENT AGREEMENT
        This Agreement is governed by the laws of the State of New York.
        Employer: TechCorp Industries
        Employee: John Doe
        Company Address: 123 Broadway, New York, NY
        Employee Address: 456 Market St, San Francisco, California

        1. Non-Compete: The Employee agrees that for a period of 24 months following termination, they shall not directly or indirectly engage in any competing business.
        2. Early Termination Penalty: If the Employee terminates this contract within the first year, they shall pay a penalty of $50,000 USD.
        3. Expiration: This agreement automatically expires on December 31, 2026. Either party may prevent renewal with 30 days written notice.
        `;

        // 1. Create the Contract record
        const contract = await Contract.create({
            userId: new mongoose.Types.ObjectId(),
            originalFileName: 'final_e2e_test.pdf',
            contractCategory: 'employment',
            status: 'processing',
            rawText: mockContractText
        });

        // Split text into clauses manually for the test
        const { splitClauses } = require('./src/services/clauseSplitter');
        const textClauses = splitClauses(mockContractText);
        
        for (const tc of textClauses) {
            await Clause.create({
                contractId: contract._id,
                segmentIndex: tc.segmentIndex,
                rawText: tc.rawText,
                clause_type: null
            });
        }

        console.log(`\n📄 Created Test Contract: ${contract._id} with ${textClauses.length} unclassified clauses`);
        console.log(`🚀 Triggering Full Orchestrator Pipeline (processContractJob)...`);

        // 2. Run the full pipeline
        await processContractJob(contract._id);

        // 3. Fetch Final Results
        const finalContract = await Contract.findById(contract._id).lean();
        const finalClauses = await Clause.find({ contractId: contract._id }).lean();

        console.log('\n======================================================');
        console.log('🎉 FINAL PIPELINE RESULTS:');
        console.log('======================================================');
        
        console.log('\n📊 1. Global Context (Phase 5 Pre-Flight / Agent 0):');
        console.log(JSON.stringify(finalContract.globalContext?.metadata, null, 2));

        console.log('\n💰 2. Extracted Financials (Phase 2 Agent 4):');
        console.log(JSON.stringify(finalContract.financial_obligations, null, 2));
        console.log(`Total Exposure: $${finalContract.total_financial_exposure}`);

        console.log('\n📅 3. Lifecycle Events (Phase 4 Agent 5):');
        console.log(JSON.stringify(finalContract.lifecycle_events, null, 2));

        console.log('\n⚖️ 4. Clause Risk Analysis (Phase 3 RAG & Phase 5 Override):');
        for (const clause of finalClauses) {
            console.log(`\n[Clause]: ${clause.rawText}`);
            console.log(`  Type: ${clause.clause_type}`);
            console.log(`  Risk Level: ${clause.risk_level?.toUpperCase()} (Score: ${clause.risk_score})`);
            console.log(`  Reasons:`);
            clause.risk_reasons?.forEach(r => console.log(`   - ${r}`));
        }

    } catch (err) {
        console.error('❌ Test failed:', err);
    } finally {
        mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

runFinalE2ETest();
