const mongoose = require('mongoose');
require('dotenv').config();
const { draftRemediation } = require('../src/services/agent8Drafter');

async function runTest() {
    console.log('--- TEST AGENT 8 DRAFTER ---');
    
    // Mock a predatory clause with verified citations
    const mockClause = {
        _id: 'mock-id-123',
        text: 'The Company reserves the right to terminate this agreement at any time, for any reason, with zero days notice. All liability is waived.',
        possible_law_references: [
            {
                act_name: 'THE INDIAN CONTRACT ACT, 1872',
                section_hint: 'Section 39',
                reason: 'A contract cannot be terminated without reasonable notice.',
                verification_status: 'verified',
                verified_act_name: 'THE INDIAN CONTRACT ACT, 1872',
                verified_section: '39'
            }
        ]
    };

    const mockRiskAnalysis = {
        risk_level: 'critical',
        explanation: 'Allows unilateral termination without notice, which is commercially unreasonable and predatory.',
        recommendation: 'Require at least 30 days prior written notice for termination without cause.'
    };

    const mockGlobalContext = {
        document_type: 'Service Agreement',
        governing_law: 'Indian Law'
    };

    console.log('\n[Original Clause]\n', mockClause.text);
    console.log('\n[Verified Citations]\n', mockClause.possible_law_references[0].verified_act_name, 'Section', mockClause.possible_law_references[0].verified_section);
    
    console.log('\nRunning Agent 8...\n');

    try {
        const rewrittenText = await draftRemediation(mockClause, mockRiskAnalysis, mockGlobalContext);
        console.log('\n[Rewritten Clause]\n', rewrittenText);

        if (rewrittenText === mockClause.text) {
            console.error('\n❌ FAILED: Agent 8 returned the original text instead of rewriting it.');
        } else {
            console.log('\n✅ PASSED: Agent 8 successfully generated a new draft.');
        }
    } catch (err) {
        console.error('\n❌ FAILED with error:', err);
    }
}

runTest();
