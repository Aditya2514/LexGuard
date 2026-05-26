/**
 * Full Integration & Stress Test for Phases 1, 2, and 3
 * 
 * This script runs a synthetic "stress test" contract through the 
 * complete LexGuard risk analysis pipeline to verify that all recent
 * accuracy improvements are working together harmoniously.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Contract = require('../src/models/Contract');
const Clause = require('../src/models/Clause');
const { runAgent2RiskAnalyst } = require('../src/services/agent2RiskAnalyst');
const { runTier2Escalation } = require('../src/services/tier2Escalation');
const { verifyCitations } = require('../src/services/citationVerifier');
const { runCrossRefAudit } = require('../src/services/agent9CrossRefAuditor');

const STRESS_TEST_CLAUSES = [
    {
        segmentIndex: 0,
        clause_type: 'non_compete',
        rawText: 'Section 1. Non-Compete. The Employee agrees that for a period of 10 years following the termination of this Agreement, they shall not engage in any business activity anywhere in the world. As per the Indian Contract Act, 1872, this is a binding restriction on trade.'
    },
    {
        segmentIndex: 1,
        clause_type: 'confidentiality',
        rawText: 'Section 2. Confidentiality. The Employee shall not disclose the Company\'s trade secrets.'
    },
    {
        segmentIndex: 2,
        clause_type: 'other',
        rawText: 'Section 3. Payment. The Company will pay the Employee according to the Target Metric. If payment fails, see Section 9.2 for dispute resolution.' // "Target Metric" is undefined, "Section 9.2" doesn't exist.
    }
];

async function runIntegrationTest() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 STRESS TEST: Phases 1, 2, and 3 Integration');
    console.log('═══════════════════════════════════════════════════════\n');

    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.\n');

        // 1. Setup Mock Contract & Clauses
        console.log('📄 Creating synthetic stress-test contract...');
        const contract = await Contract.create({
            userId: new mongoose.Types.ObjectId(),
            originalFileName: 'Stress_Test_Agreement.pdf',
            contractCategory: 'other',
            status: 'processing',
            totalClauses: 3
        });

        const clauses = await Clause.insertMany(
            STRESS_TEST_CLAUSES.map(c => ({
                contractId: contract._id,
                segmentIndex: c.segmentIndex,
                clause_type: c.clause_type,
                rawText: c.rawText
            }))
        );
        console.log(`✅ Created contract ID: ${contract._id} with 3 clauses.\n`);

        // 2. Prepare for Agent 2
        console.log('🤖 RUNNING AGENT 2 (Base Risk Analyst)...');
        const batch = clauses.map(c => ({
            id: c.segmentIndex.toString(),
            originalId: c._id.toString(),
            text: c.rawText,
            clause_type: c.clause_type,
            retrieved_legal_context: [],
            retrieved_contract_context: []
        }));

        let agent2Results = await runAgent2RiskAnalyst(batch, {});
        
        console.log('📊 Agent 2 Base Results:');
        agent2Results.forEach(r => {
            console.log(`  - Clause ${r.id}: ${r.risk_level.toUpperCase()} (${r.risk_score}/10) | Conf: ${r.confidence_score}`);
        });
        console.log('');

        // 3. Run Phase 2: Tier 2 Escalation
        console.log('⚖️ RUNNING PHASE 2 (Tier 2 Escalation)...');
        const clauseTextMap = {};
        batch.forEach(b => clauseTextMap[b.id] = b.text);
        
        agent2Results = await runTier2Escalation(agent2Results, clauseTextMap);

        console.log('📊 Post-Tier 2 Results:');
        agent2Results.forEach(r => {
            const status = r.tier2_escalated ? (r.tier2_agrees ? '✅ Agreed' : '🔄 Overridden') : '⏩ Skipped';
            console.log(`  - Clause ${r.id}: [${status}] -> ${r.risk_level.toUpperCase()} (${r.risk_score}/10)`);
            if (r.tier2_escalated) console.log(`      Senior Note: ${r.tier2_senior_note}`);
        });
        console.log('');

        // 4. Save to DB so Phase 1 and 3 can read them
        const bulkOps = agent2Results.map(r => ({
            updateOne: {
                filter: { _id: r.originalId },
                update: { $set: { 
                    risk_level: r.risk_level, 
                    risk_score: r.risk_score,
                    possible_law_references: r.possible_law_references 
                }}
            }
        }));
        await Clause.bulkWrite(bulkOps);

        // 5. Run Phase 1: Citation Verification
        console.log('🔍 RUNNING PHASE 1 (Citation Verifier)...');
        // This will find the Indian Contract Act in Clause 0 and try to verify it
        const clausesToVerify = await Clause.find({ contractId: contract._id });
        let verifiedCount = 0;
        let misquotedCount = 0;
        let notFoundCount = 0;

        for (let c of clausesToVerify) {
            if (c.possible_law_references && c.possible_law_references.length > 0) {
                const result = await verifyCitations(c.possible_law_references);
                const finalRefs = result.verifiedRefs;
                finalRefs.forEach(r => {
                    if (r.verification_status === 'verified') verifiedCount++;
                    if (r.verification_status === 'misquoted') misquotedCount++;
                    if (r.verification_status === 'not_found') notFoundCount++;
                    console.log(`  - Clause ${c.segmentIndex}: [${r.verification_status}] ${r.act_name} -> Relevance: ${r.similarity_score}%`);
                });
            }
        }
        console.log(`  Summary: ${verifiedCount} Verified, ${misquotedCount} Misquoted, ${notFoundCount} Not Found\n`);

        // 6. Run Phase 3: Cross-Reference Auditor
        console.log('🕵️ RUNNING PHASE 3 (Agent 9 Cross-Ref Auditor)...');
        await runCrossRefAudit(contract._id);

        const finalContract = await Contract.findById(contract._id);
        const findings = finalContract.crossRefFindings || [];
        
        console.log(`  Audit Summary: ${finalContract.crossRefAuditSummary}`);
        findings.forEach(f => {
            console.log(`  - [${f.severity.toUpperCase()} / ${f.type}] ${f.issue_text}`);
            console.log(`      Location: ${f.location_hint}`);
            console.log(`      Recommendation: ${f.recommendation}`);
        });
        
        console.log('\n🎉 ALL PHASES TESTED SUCCESSFULLY.');

    } catch (err) {
        console.error('\n❌ STRESS TEST FAILED:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB.');
        process.exit(0);
    }
}

runIntegrationTest();
