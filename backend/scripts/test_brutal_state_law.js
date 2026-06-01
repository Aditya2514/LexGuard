const { retrieveComplianceContext } = require('../src/services/lawRetrieverService');
const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

async function verifyStateLawRouting() {
    console.log('⚖️ Verifying Phase 8: State-Level Jurisdiction Routing\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        // Let's test a termination clause.
        // Under Central law (or generic contract law), a standard 15-day notice might be fine if agreed upon.
        // Under Karnataka state law, Section 39 requires a minimum of 1-month notice for employees with >6 months service.
        const testClauseText = "The employer may terminate this agreement at any time by providing 15 days written notice.";
        
        console.log(`\n--- Test 1: Generic/Central Jurisdiction ---`);
        console.log(`Querying Vector Search without state routing (Default: Central)`);
        const centralContext = await retrieveComplianceContext('Employment', 'termination', testClauseText, 'Central');
        
        // In a real database, this might fetch generic IPC/contract laws. We just want to ensure it DOES NOT fetch Karnataka laws.
        const isKarnatakaInCentral = JSON.stringify(centralContext).includes('Karnataka');
        console.log(`Result: Does Central query bleed Karnataka law? -> ${isKarnatakaInCentral ? '❌ YES (Fail)' : '✅ NO (Pass)'}`);

        console.log(`\n--- Test 2: Karnataka Jurisdiction ---`);
        console.log(`Querying Vector Search with explicitly routed jurisdiction: 'Karnataka'`);
        const stateContext = await retrieveComplianceContext('Employment', 'termination', testClauseText, 'Karnataka');
        
        const isKarnatakaFetched = JSON.stringify(stateContext).includes('Karnataka Shops and Commercial Establishments Act');
        console.log(`Result: Did Vector Search fetch the Karnataka law? -> ${isKarnatakaFetched ? '✅ YES (Pass)' : '❌ NO (Fail)'}`);

        if (isKarnatakaFetched) {
            console.log(`\nExcerpt retrieved:`);
            const excerpt = stateContext.find(s => s.includes('Karnataka Shops'));
            console.log(excerpt.substring(0, 150) + '...');
        }

    } catch (err) {
        console.error('❌ Verification failed:', err);
    } finally {
        mongoose.disconnect();
        process.exit(0);
    }
}

verifyStateLawRouting();
