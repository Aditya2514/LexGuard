/**
 * Test script for Phase 2: Tier 2 Escalation
 * 
 * This script tests the standalone Tier 2 escalation service with a mock
 * set of clauses to ensure Gemini 2.5 Flash properly overrides or agrees
 * with the base model.
 */
require('dotenv').config();
const { runTier2Escalation } = require('../src/services/tier2Escalation');

const MOCK_CLAUSE_TEXT_MAP = {
    'c1': 'The Employee agrees not to engage in any competing business anywhere in the world for a period of 5 years following termination of this Agreement.',
    'c2': 'This Agreement shall be governed by the laws of India.',
    'c3': 'The Employee shall maintain strict confidentiality regarding the Company\'s trade secrets.'
};

const MOCK_BASE_RESULTS = [
    {
        id: 'c1',
        risk_level: 'high',
        risk_score: 8,
        confidence_score: 5, // Low confidence on high risk -> should trigger Tier 2
        risk_reasons: ['Extremely broad geographic and temporal non-compete'],
        possible_law_references: [
            {
                act_key: 'INDIAN_CONTRACT_ACT',
                act_name: 'Indian Contract Act, 1872',
                section_hint: 'Section 27',
                reason: 'Restraint of trade'
            }
        ]
    },
    {
        id: 'c2',
        risk_level: 'low',
        risk_score: 1,
        confidence_score: 9, // High confidence on low risk -> should skip Tier 2
        risk_reasons: ['Standard governing law clause'],
        possible_law_references: []
    },
    {
        id: 'c3',
        risk_level: 'critical', // Very high risk -> should trigger Tier 2
        risk_score: 9,
        confidence_score: 8,
        risk_reasons: ['Confidentiality clause is dangerous'], // Junior analyst over-reacted
        possible_law_references: []
    }
];

async function runTest() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 Phase 2 Test: Tier 2 Escalation (Mock Run)');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('── Base Analyst Results ─────────────────────────────');
    MOCK_BASE_RESULTS.forEach(r => {
        console.log(`Clause ${r.id}: ${r.risk_level} (${r.risk_score}/10) | Conf: ${r.confidence_score}/10`);
    });
    console.log('\nRunning Tier 2 Escalation...\n');

    const startTime = Date.now();
    const finalResults = await runTier2Escalation(MOCK_BASE_RESULTS, MOCK_CLAUSE_TEXT_MAP);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n⏱️  Completed in ${elapsed}s\n`);
    console.log('── Final Results (After Tier 2) ─────────────────────');

    finalResults.forEach(r => {
        const tier2Status = !r.tier2_escalated ? 'Skipped (Low Risk)' 
                          : r.tier2_agrees ? '✅ Agreed' 
                          : '🔄 Overridden';
        
        console.log(`Clause ${r.id}: [Tier 2: ${tier2Status}]`);
        console.log(`   Final Risk: ${r.risk_level.toUpperCase()} (${r.risk_score}/10) | Conf: ${r.confidence_score}/10`);
        if (r.tier2_escalated) {
            console.log(`   Senior Note: ${r.tier2_senior_note}`);
        }
        console.log('');
    });

    console.log('🎉 Phase 2 Mock Test Complete!\n');
    process.exit(0);
}

runTest().catch(err => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
});
