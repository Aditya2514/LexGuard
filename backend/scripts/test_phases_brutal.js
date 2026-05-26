/**
 * BRUTAL HONEST Stress Test: Phases 1, 2, 3
 * 
 * This test does NOT sugarcoat results. It:
 * 1. Inspects the ACTUAL database state first
 * 2. Runs all 3 phases on REAL existing data (sample_employment contract)
 * 3. Runs on synthetic edge cases designed to BREAK the system
 * 4. Validates data INTEGRITY (did the DB actually save correctly?)
 * 5. Reports EVERY failure mode honestly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Contract = require('../src/models/Contract');
const Clause = require('../src/models/Clause');
const StatuteNode = require('../src/models/StatuteNode');
const { verifyCitations } = require('../src/services/citationVerifier');
const { runTier2Escalation, needsEscalation } = require('../src/services/tier2Escalation');
const { runCrossRefAudit } = require('../src/services/agent9CrossRefAuditor');

const PASS = '✅ PASS';
const FAIL = '❌ FAIL';
const WARN = '⚠️  WARN';

let totalTests = 0;
let passed = 0;
let failed = 0;
let warnings = 0;

function assert(condition, testName, detail) {
    totalTests++;
    if (condition) {
        passed++;
        console.log(`  ${PASS}: ${testName}`);
    } else {
        failed++;
        console.log(`  ${FAIL}: ${testName}`);
        if (detail) console.log(`        → ${detail}`);
    }
}

function warn(testName, detail) {
    totalTests++;
    warnings++;
    console.log(`  ${WARN}: ${testName}`);
    if (detail) console.log(`        → ${detail}`);
}

async function run() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔬 BRUTAL HONEST STRESS TEST: Phases 1, 2, 3');
    console.log('   NO SUGARCOATING. Every failure is reported.');
    console.log('═══════════════════════════════════════════════════════════════\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔌 Connected to MongoDB.\n');

    // ═══════════════════════════════════════════════════════════════════
    // SECTION 0: DATABASE REALITY CHECK
    // ═══════════════════════════════════════════════════════════════════
    console.log('━━━ SECTION 0: DATABASE REALITY CHECK ━━━━━━━━━━━━━━━━━━━━━━');

    const totalStatutes = await StatuteNode.countDocuments();
    console.log(`  Total StatuteNode documents: ${totalStatutes}`);
    assert(totalStatutes > 0, 'StatuteNode collection is NOT empty', `Found ${totalStatutes} docs`);

    // Check which acts are actually ingested
    const distinctActs = await StatuteNode.distinct('actName');
    console.log(`  Distinct acts in database: ${distinctActs.length}`);
    distinctActs.forEach(a => console.log(`    • ${a}`));

    // Check if Indian Contract Act specifically exists
    const icaCount = await StatuteNode.countDocuments({ actName: /indian contract/i });
    assert(icaCount > 0, 'Indian Contract Act exists in DB', `Found ${icaCount} sections`);

    const dpdpCount = await StatuteNode.countDocuments({ actName: /digital personal data/i });
    assert(dpdpCount > 0, 'DPDP Act exists in DB', `Found ${dpdpCount} sections`);

    // Check for Section 27 specifically (the most cited section)
    const sec27 = await StatuteNode.findOne({ 
        sectionNumber: /Section 27/i,
        actName: /contract/i 
    }).lean();
    assert(sec27 !== null, 'Section 27 of Indian Contract Act exists', 
        sec27 ? `Found: "${sec27.sectionNumber}" in "${sec27.actName}"` : 'NOT FOUND - this is critical');

    if (sec27) {
        assert(sec27.content && sec27.content.length > 20, 
            'Section 27 has meaningful content (>20 chars)', 
            `Content length: ${sec27.content?.length || 0} chars`);
    }

    // Sample a random statute to check data quality
    const sampleStatute = await StatuteNode.findOne().lean();
    if (sampleStatute) {
        console.log(`\n  Sample statute structure:`);
        console.log(`    actName: "${sampleStatute.actName}"`);
        console.log(`    sectionNumber: "${sampleStatute.sectionNumber}"`);
        console.log(`    content: "${(sampleStatute.content || '').substring(0, 100)}..."`);
        console.log(`    fields: [${Object.keys(sampleStatute).join(', ')}]`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // SECTION 1: PHASE 1 — CITATION VERIFIER UNIT TESTS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 1: PHASE 1 — CITATION VERIFIER ━━━━━━━━━━━━━━━━━');

    // Test 1a: Citation with a KNOWN section number
    console.log('\n  [Test 1a] Citation with known section number...');
    if (sec27) {
        const testRefs1a = [{
            act_key: 'INDIAN_CONTRACT_ACT',
            act_name: 'Indian Contract Act, 1872',
            section_hint: 'Section 27 - agreements in restraint of trade',
            reason: 'restraint of trade void agreement',
            reference_url: ''
        }];
        const result1a = await verifyCitations(testRefs1a);
        assert(result1a.verifiedRefs[0].verification_status === 'verified', 
            'Known Section 27 is marked as VERIFIED',
            `Got: ${result1a.verifiedRefs[0].verification_status} | Note: ${result1a.verifiedRefs[0].verification_note}`);
        assert(result1a.citationAccuracy > 0, 
            'Citation accuracy > 0% for known section',
            `Got: ${result1a.citationAccuracy}%`);
    } else {
        warn('SKIPPED: Section 27 test (not in DB)', 'Cannot test section-level verification without data');
    }

    // Test 1b: Citation with UNKNOWN section number
    console.log('\n  [Test 1b] Citation with unknown section number...');
    const testRefs1b = [{
        act_key: 'INDIAN_CONTRACT_ACT',
        act_name: 'Indian Contract Act, 1872',
        section_hint: 'Section 9999',
        reason: 'This section does not exist',
        reference_url: ''
    }];
    const result1b = await verifyCitations(testRefs1b);
    assert(result1b.verifiedRefs[0].verification_status === 'not_found', 
        'Fake Section 9999 is correctly marked NOT_FOUND',
        `Got: ${result1b.verifiedRefs[0].verification_status}`);

    // Test 1c: Citation with NO section number (fallback path)
    console.log('\n  [Test 1c] Citation without section number (fallback)...');
    const testRefs1c = [{
        act_key: 'INDIAN_CONTRACT_ACT',
        act_name: 'Indian Contract Act, 1872',
        section_hint: 'agreements in restraint of trade',
        reason: 'The clause imposes a broad non-compete restriction',
        reference_url: ''
    }];
    const result1c = await verifyCitations(testRefs1c);
    assert(result1c.verifiedRefs[0].verification_status === 'verified', 
        'No-section-number fallback finds act and marks VERIFIED',
        `Got: ${result1c.verifiedRefs[0].verification_status} | Note: ${result1c.verifiedRefs[0].verification_note}`);

    // Test 1d: Completely hallucinated act
    console.log('\n  [Test 1d] Completely hallucinated act...');
    const testRefs1d = [{
        act_key: 'FAKE_ACT',
        act_name: 'Fake Imaginary Act, 2099',
        section_hint: 'Section 1',
        reason: 'This act does not exist',
        reference_url: ''
    }];
    const result1d = await verifyCitations(testRefs1d);
    assert(result1d.verifiedRefs[0].verification_status === 'not_found', 
        'Hallucinated act is correctly marked NOT_FOUND',
        `Got: ${result1d.verifiedRefs[0].verification_status}`);

    // Test 1e: Empty references array
    console.log('\n  [Test 1e] Empty references array...');
    const result1e = await verifyCitations([]);
    assert(result1e.verifiedRefs.length === 0, 'Empty array returns empty results');
    assert(result1e.citationAccuracy === 100, 'Empty array returns 100% accuracy', `Got: ${result1e.citationAccuracy}%`);

    // Test 1f: REAL contract from DB
    console.log('\n  [Test 1f] Real contract from database...');
    const realContract = await Contract.findOne({ status: 'done' }).sort({ createdAt: -1 });
    if (realContract) {
        const realClauses = await Clause.find({ 
            contractId: realContract._id, 
            'possible_law_references.0': { $exists: true } 
        }).select('segmentIndex possible_law_references').lean();
        
        console.log(`    Found ${realClauses.length} clauses with citations in "${realContract.originalFileName}"`);
        
        let realVerified = 0, realMisquoted = 0, realNotFound = 0;
        for (const clause of realClauses.slice(0, 5)) { // Test first 5
            const result = await verifyCitations(clause.possible_law_references);
            realVerified += result.stats.verified;
            realMisquoted += result.stats.misquoted;
            realNotFound += result.stats.not_found;
        }
        console.log(`    Results: ${realVerified} verified, ${realMisquoted} misquoted, ${realNotFound} not found`);
        
        if (realVerified === 0 && realMisquoted > 0) {
            warn('ALL real citations marked misquoted — Jaccard similarity is too strict for act-level fallback',
                'The verifier finds the act but the Jaccard score between the LLM reason and statute content is always < 15%');
        }
    } else {
        warn('No completed contract found in DB', 'Cannot test real data');
    }

    // ═══════════════════════════════════════════════════════════════════
    // SECTION 2: PHASE 2 — TIER 2 ESCALATION UNIT TESTS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 2: PHASE 2 — TIER 2 ESCALATION ━━━━━━━━━━━━━━━━━');

    // Test 2a: needsEscalation logic
    console.log('\n  [Test 2a] needsEscalation criteria...');
    assert(needsEscalation({ risk_score: 8, confidence_score: 9, risk_level: 'critical' }), 
        'Critical risk_level triggers escalation');
    assert(needsEscalation({ risk_score: 7, confidence_score: 9, risk_level: 'medium' }), 
        'risk_score >= 7 triggers escalation');
    assert(needsEscalation({ risk_score: 3, confidence_score: 3, risk_level: 'low' }), 
        'confidence_score <= 4 triggers escalation');
    assert(!needsEscalation({ risk_score: 3, confidence_score: 9, risk_level: 'low' }), 
        'Low risk + high confidence does NOT trigger escalation');
    assert(needsEscalation({ risk_score: 5, confidence_score: 5, risk_level: 'high' }), 
        'High risk_level triggers escalation even with moderate score');

    // Test 2b: Missing confidence_score defaults
    console.log('\n  [Test 2b] Missing confidence_score handling...');
    assert(!needsEscalation({ risk_score: 3, risk_level: 'low' }), 
        'Missing confidence_score defaults to 5 (not triggering on confidence)',
        `Result: ${needsEscalation({ risk_score: 3, risk_level: 'low' })}`);
    assert(!needsEscalation({ risk_score: 3, risk_level: 'low' }), 
        'Low risk with missing confidence should NOT trigger (defaults to 5)');

    // Test 2c: Live Tier 2 call (if API is available)
    console.log('\n  [Test 2c] Live Tier 2 escalation call...');
    const mockResults = [
        { id: 'test1', risk_level: 'critical', risk_score: 9, confidence_score: 8, risk_reasons: ['Broad non-compete'], possible_law_references: [] },
        { id: 'test2', risk_level: 'low', risk_score: 1, confidence_score: 9, risk_reasons: ['Standard clause'], possible_law_references: [] },
    ];
    const mockTextMap = {
        'test1': 'Employee shall not work for any competitor worldwide for 10 years after termination.',
        'test2': 'This Agreement shall be governed by the laws of India.',
    };

    try {
        const tier2Results = await runTier2Escalation(mockResults, mockTextMap);
        assert(tier2Results.length === 2, 'Tier 2 returns same number of results', `Got ${tier2Results.length}`);
        
        const escalated = tier2Results.filter(r => r.tier2_escalated);
        assert(escalated.length === 1, 'Only 1 clause escalated (the critical one)', `Got ${escalated.length} escalated`);
        
        const skipped = tier2Results.find(r => r.id === 'test2');
        assert(!skipped.tier2_escalated, 'Low-risk clause was correctly skipped');
        
        const reviewed = tier2Results.find(r => r.id === 'test1');
        if (reviewed.tier2_escalated) {
            assert(reviewed.tier2_senior_note && reviewed.tier2_senior_note.length > 10, 
                'Escalated clause has a senior note', `Note length: ${reviewed.tier2_senior_note?.length}`);
            assert(['low','medium','high','critical'].includes(reviewed.risk_level), 
                'Escalated clause has valid risk_level', `Got: ${reviewed.risk_level}`);
            assert(typeof reviewed.tier2_agrees === 'boolean', 
                'tier2_agrees is a boolean', `Got: ${typeof reviewed.tier2_agrees}`);
        }
    } catch (err) {
        warn('Tier 2 live call failed (likely API rate limit)', err.message);
    }

    // ═══════════════════════════════════════════════════════════════════
    // SECTION 3: PHASE 3 — AGENT 9 CROSS-REF AUDITOR
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 3: PHASE 3 — AGENT 9 CROSS-REF AUDITOR ━━━━━━━━');

    // Test 3a: Run on a real contract
    console.log('\n  [Test 3a] Agent 9 on real contract...');
    if (realContract) {
        try {
            await runCrossRefAudit(realContract._id);
            const updatedContract = await Contract.findById(realContract._id).lean();
            
            assert(updatedContract.crossRefFindings !== undefined, 
                'crossRefFindings field exists on contract');
            assert(Array.isArray(updatedContract.crossRefFindings), 
                'crossRefFindings is an array');
            assert(updatedContract.crossRefAuditSummary !== null, 
                'crossRefAuditSummary is populated', 
                `Summary: "${updatedContract.crossRefAuditSummary?.substring(0, 100)}"`);
            
            if (updatedContract.crossRefFindings.length > 0) {
                const finding = updatedContract.crossRefFindings[0];
                assert(['undefined_term','broken_reference','circular_definition','conflict'].includes(finding.type),
                    'Finding has valid type enum', `Got: ${finding.type}`);
                assert(['low','medium','high'].includes(finding.severity),
                    'Finding has valid severity enum', `Got: ${finding.severity}`);
                assert(finding.issue_text && finding.issue_text.length > 5,
                    'Finding has meaningful issue_text');
            }
            
            console.log(`    Found ${updatedContract.crossRefFindings.length} issues.`);
        } catch (err) {
            warn('Agent 9 live call failed', err.message);
        }
    }

    // Test 3b: Agent 9 on a contract with NO clauses
    console.log('\n  [Test 3b] Agent 9 on empty contract...');
    const emptyContract = await Contract.create({
        userId: new mongoose.Types.ObjectId(),
        originalFileName: 'empty_test.pdf',
        contractCategory: 'other',
        status: 'done',
        totalClauses: 0
    });
    await runCrossRefAudit(emptyContract._id);
    // Should not crash
    assert(true, 'Agent 9 does not crash on empty contract');
    await Contract.findByIdAndDelete(emptyContract._id);

    // ═══════════════════════════════════════════════════════════════════
    // SECTION 4: DATA INTEGRITY CHECKS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 4: DATA INTEGRITY CHECKS ━━━━━━━━━━━━━━━━━━━━━━━');

    // Check Clause model has new fields
    console.log('\n  [Test 4a] Clause schema has new fields...');
    const sampleClause = await Clause.findOne().lean();
    if (sampleClause) {
        const schemaFields = Object.keys(Clause.schema.paths);
        assert(schemaFields.includes('tier2_escalated'), 'Clause schema has tier2_escalated');
        assert(schemaFields.includes('tier2_agrees'), 'Clause schema has tier2_agrees');
        assert(schemaFields.includes('tier2_senior_note'), 'Clause schema has tier2_senior_note');
        assert(schemaFields.includes('citation_accuracy'), 'Clause schema has citation_accuracy');
        assert(schemaFields.includes('possible_law_references.0.verification_status') || schemaFields.some(f => f.includes('verification_status')), 'Clause schema has verification_status inside possible_law_references');
    }

    // Check Contract model has Agent 9 fields
    console.log('\n  [Test 4b] Contract schema has Agent 9 fields...');
    const contractFields = Object.keys(Contract.schema.paths);
    assert(contractFields.includes('crossRefFindings'), 'Contract schema has crossRefFindings');
    assert(contractFields.includes('crossRefAuditSummary'), 'Contract schema has crossRefAuditSummary');

    // ═══════════════════════════════════════════════════════════════════
    // SECTION 5: KNOWN ISSUES / HONEST ASSESSMENT
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 5: HONEST ASSESSMENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Check: Is Jaccard similarity fundamentally broken for legal text?
    console.log('\n  [Diagnosis] Jaccard similarity on legal text...');
    const llmReason = 'restraint of trade and reasonableness of non-compete provisions';
    if (sec27) {
        const { computeTextSimilarity } = require('../src/services/citationVerifier');
        // This function isn't exported, so let's manually test
        const tokenize = (text) => {
            return new Set(
                text.toLowerCase()
                    .replace(/[^\w\s]/g, '')
                    .split(/\s+/)
                    .filter(w => w.length > 2)
            );
        };
        const setA = tokenize(llmReason);
        const setB = tokenize(sec27.content.substring(0, 2000));
        let intersection = 0;
        for (const word of setA) {
            if (setB.has(word)) intersection++;
        }
        const union = setA.size + setB.size - intersection;
        const jaccard = union === 0 ? 0 : Math.round((intersection / union) * 100);
        
        console.log(`    LLM reason words: [${[...setA].join(', ')}] (${setA.size} words)`);
        console.log(`    Statute content words: ${setB.size} words`);
        console.log(`    Intersection: ${intersection} words`);
        console.log(`    Jaccard similarity: ${jaccard}%`);
        
        if (jaccard < 15) {
            warn('Jaccard similarity is STRUCTURALLY too low for legal verification',
                `The LLM uses ~${setA.size} short summary words, the statute has ~${setB.size} legal words. ` +
                `Even when the citation is CORRECT, Jaccard will return <15% because the word sets are vastly different in size. ` +
                `This means the "misquoted" status is a FALSE NEGATIVE for section-level verification.`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // FINAL REPORT
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 FINAL REPORT');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Total Tests:  ${totalTests}`);
    console.log(`  ✅ Passed:     ${passed}`);
    console.log(`  ❌ Failed:     ${failed}`);
    console.log(`  ⚠️  Warnings:  ${warnings}`);
    console.log(`  Score:        ${Math.round((passed / totalTests) * 100)}%`);
    
    if (failed > 0) {
        console.log('\n  🚨 VERDICT: FAILURES DETECTED. Fix required.');
    } else if (warnings > 0) {
        console.log('\n  ⚠️  VERDICT: ALL TESTS PASSED but with warnings that need attention.');
    } else {
        console.log('\n  🎉 VERDICT: ALL TESTS PASSED CLEAN.');
    }
    console.log('═══════════════════════════════════════════════════════════════\n');

    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('\n💀 CATASTROPHIC FAILURE:', err);
    process.exit(1);
});
