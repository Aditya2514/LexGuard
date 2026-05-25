require('dotenv').config();
const mongoose = require('mongoose');
const { retrieveCaseLawPrecedents } = require('./src/services/ragCaseLawService');

async function testCaseLawRAG() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Test 1: Post-employment Non-Compete (Should retrieve Percept D'Mark)
        const postEmploymentClause = "The Employee agrees that for a period of 24 months following the termination of this Agreement, they shall not directly or indirectly engage in any business that competes with the Company.";
        console.log(`\n🔍 Query 1: Post-Employment Non-Compete`);
        console.log(`Clause: "${postEmploymentClause}"`);
        
        const results1 = await retrieveCaseLawPrecedents(postEmploymentClause, 2, 0.4);
        console.log(`Retrieved ${results1.length} precedents:`);
        results1.forEach((r, i) => console.log(`  [${i+1}] Score: ${r.score.toFixed(3)} | Case: ${r.case_title}`));

        // Test 2: Unfair termination (Should retrieve Central Inland)
        const unfairTerminationClause = "The Company reserves the right to terminate the Employee's permanent employment at any time, without assigning any reason whatsoever, by providing 30 days notice.";
        console.log(`\n🔍 Query 2: Unfair Termination`);
        console.log(`Clause: "${unfairTerminationClause}"`);
        
        const results2 = await retrieveCaseLawPrecedents(unfairTerminationClause, 2, 0.4);
        console.log(`Retrieved ${results2.length} precedents:`);
        results2.forEach((r, i) => console.log(`  [${i+1}] Score: ${r.score.toFixed(3)} | Case: ${r.case_title}`));

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

testCaseLawRAG();
