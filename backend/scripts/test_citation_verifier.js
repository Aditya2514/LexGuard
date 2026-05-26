/**
 * Test script for Phase 1: Citation Verification Layer
 * 
 * This script:
 * 1. Connects to MongoDB
 * 2. Finds a contract that has already been analyzed (has law references)
 * 3. Runs the Citation Verifier on it
 * 4. Reports the results
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Clause = require('../src/models/Clause');
const Contract = require('../src/models/Contract');
const { verifyCitationsForContract, verifyCitations } = require('../src/services/citationVerifier');

async function runTest() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 Phase 1 Test: Citation Verification Layer');
    console.log('═══════════════════════════════════════════════════════\n');

    // 1. Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.\n');

    // 2. Find a contract that has analyzed clauses with law references
    const clauseWithRefs = await Clause.findOne({
        'possible_law_references.0': { $exists: true },
        risk_level: { $ne: null }
    }).select('contractId');

    if (!clauseWithRefs) {
        console.log('❌ No analyzed clauses with law references found in the database.');
        console.log('   You need to upload and analyze a contract first.');
        await mongoose.disconnect();
        process.exit(1);
    }

    const contractId = clauseWithRefs.contractId;
    const contract = await Contract.findById(contractId).select('originalFileName');
    console.log(`📄 Found contract: "${contract?.originalFileName || contractId}"`);

    // 3. Show what we're working with BEFORE verification
    const clausesBefore = await Clause.find({
        contractId,
        'possible_law_references.0': { $exists: true }
    }).select('segmentIndex possible_law_references citation_accuracy');

    console.log(`📊 Found ${clausesBefore.length} clauses with law references.\n`);

    // Show a sample of citations before verification
    console.log('── BEFORE Verification ──────────────────────────────');
    for (const clause of clausesBefore.slice(0, 3)) {
        console.log(`  Clause #${clause.segmentIndex + 1}:`);
        for (const ref of clause.possible_law_references) {
            const status = ref.verification_status || 'NOT YET VERIFIED';
            console.log(`    📜 ${ref.act_name} → ${ref.section_hint} [${status}]`);
        }
    }
    console.log('');

    // 4. Run the Citation Verifier
    console.log('🔍 Running Citation Verification Layer...\n');
    const startTime = Date.now();
    const result = await verifyCitationsForContract(contractId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n⏱️  Completed in ${elapsed}s\n`);

    // 5. Show results AFTER verification
    const clausesAfter = await Clause.find({
        contractId,
        'possible_law_references.0': { $exists: true }
    }).select('segmentIndex possible_law_references citation_accuracy');

    console.log('── AFTER Verification ───────────────────────────────');
    let totalVerified = 0;
    let totalMisquoted = 0;
    let totalNotFound = 0;
    let totalNA = 0;

    for (const clause of clausesAfter) {
        console.log(`  Clause #${clause.segmentIndex + 1} (Citation Accuracy: ${clause.citation_accuracy}%):`);
        for (const ref of clause.possible_law_references) {
            const icon = ref.verification_status === 'verified' ? '✅'
                : ref.verification_status === 'misquoted' ? '⚠️'
                : ref.verification_status === 'not_found' ? '❌'
                : ref.verification_status === 'not_applicable' ? 'ℹ️'
                : '❓';
            
            console.log(`    ${icon} ${ref.act_name} → ${ref.section_hint} [${ref.verification_status}]`);
            if (ref.verification_note && ref.verification_status !== 'verified' && ref.verification_status !== 'not_applicable') {
                console.log(`       └─ ${ref.verification_note}`);
            }

            if (ref.verification_status === 'verified') totalVerified++;
            else if (ref.verification_status === 'misquoted') totalMisquoted++;
            else if (ref.verification_status === 'not_found') totalNotFound++;
            else if (ref.verification_status === 'not_applicable') totalNA++;
        }
    }

    // 6. Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Total Clauses Checked:  ${result.totalClauses}`);
    console.log(`  Average Accuracy:       ${result.avgAccuracy}%`);
    console.log(`  ✅ Verified Citations:   ${totalVerified}`);
    console.log(`  ⚠️  Misquoted Citations: ${totalMisquoted}`);
    console.log(`  ❌ Not Found (Possible Hallucinations): ${totalNotFound}`);
    console.log(`  ℹ️  Not Applicable (Case Law/Other):    ${totalNA}`);
    console.log('═══════════════════════════════════════════════════════');

    if (totalNotFound > 0) {
        console.log('\n⚠️  NOTE: "Not Found" citations may be legitimate statutes');
        console.log('   that haven\'t been ingested yet. Once the Colab bulk');
        console.log('   ingestion finishes, re-run this test for more accurate results.');
    }

    console.log('\n🎉 Phase 1 Test Complete!');
    await mongoose.disconnect();
    process.exit(0);
}

runTest().catch(err => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
});
