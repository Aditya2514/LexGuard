require('dotenv').config();
const mongoose = require('mongoose');
const Contract = require('../src/models/Contract');
const Clause = require('../src/models/Clause');
const { runAgent2RiskAnalyst } = require('../src/services/agent2RiskAnalyst');
const { verifyCitations } = require('../src/services/citationVerifier');
const { runCrossRefAudit } = require('../src/services/agent9CrossRefAuditor');
const { runTier2Escalation } = require('../src/services/tier2Escalation');

const ULTIMATE_ADVERSARIAL_CLAUSES = [
    {
        clauseId: 'phantom-arbitration-101',
        text: 'Disputes shall be resolved favorably through arbitration to save costs. However, said arbitration shall be conducted exclusively in the Principality of Sealand, under the internal rules of the Company, and the User must deposit a non-refundable retainer of $50,000 USD before initiating any claim. All statutory remedies are hereby irrevocably waived.',
        metadata: { source: 'Adversarial Test - Jurisdiction Trap' }
    },
    {
        clauseId: 'dark-pattern-privacy-202',
        text: 'We respect your privacy and will not sell your data unless you fail to not opt-in within 24 hours of account creation by mailing a physical letter to our offshore holding company. Otherwise, you grant us an irrevocable, perpetual, royalty-free license to monetize your biometric telemetry, genetic information, and real-time location data with third-party data brokers for marketing purposes.',
        metadata: { source: 'Adversarial Test - Dark Pattern Privacy' }
    },
    {
        clauseId: 'unilateral-liquidation-303',
        text: 'The Company reserves the right to amend these Terms at any time without prior notice. Continued use constitutes acceptance. Should the User violate any amended Term, even retroactively, the Company may unilaterally liquidate and seize any funds or digital assets held in the User\'s account as liquidated damages, without any right to appeal or judicial review.',
        metadata: { source: 'Adversarial Test - Unilateral Seizure' }
    }
];

async function runUltimateTest() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('☠️  ULTIMATE ADVERSARIAL TEST');
    console.log('   Testing the AI against draconian traps hidden behind friendly language.');
    console.log('═══════════════════════════════════════════════════════════════\\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connected to MongoDB.\\n');

        const dummyContract = new Contract({
            userId: new mongoose.Types.ObjectId(),
            originalFileName: 'ultimate_trap_contract.pdf',
            contractCategory: 'tos',
        });
        await dummyContract.save();
        console.log(`📄 Created ultimate adversarial contract ID: ${dummyContract._id}\\n`);

        const clauseDocs = [];
        for (let i = 0; i < ULTIMATE_ADVERSARIAL_CLAUSES.length; i++) {
             const c = new Clause({
                 contractId: dummyContract._id,
                 segmentIndex: i,
                 rawText: ULTIMATE_ADVERSARIAL_CLAUSES[i].text,
                 embedding: [0.1, 0.2, 0.3], // Dummy
                 riskScore: 0,
                 analysis: '',
                 citations: []
             });
             await c.save();
             clauseDocs.push(c);
        }

        // 1. RISK ANALYSIS (batch all 3 clauses at once)
        console.log('🤖 RUNNING RISK ANALYSIS (Agent 2 + Tier 2)...');
        const clauseBatch = clauseDocs.map((c, i) => ({ id: i, text: c.rawText }));
        const clauseTextMap = {};
        clauseBatch.forEach(c => { clauseTextMap[c.id] = c.text; });

        let aiResults = await runAgent2RiskAnalyst(clauseBatch);

        // Tier 2 Escalation
        aiResults = await runTier2Escalation(aiResults, clauseTextMap);

        // Save results back to Clause docs
        for (let i = 0; i < clauseDocs.length; i++) {
            const r = aiResults[i] || {};
            clauseDocs[i].risk_level = r.risk_level || 'medium';
            clauseDocs[i].risk_score = r.risk_score || 5;
            clauseDocs[i].analysis = (r.risk_reasons || []).join(' ');
            clauseDocs[i].possible_law_references = r.possible_law_references || [];
            await clauseDocs[i].save();
        }

        console.log('\n📊 FINAL RISK RESULTS:\n');
        for (let i = 0; i < aiResults.length; i++) {
            const r = aiResults[i];
            const rawText = clauseDocs[i].rawText;
            console.log(`  CLAUSE ${i}: [${ULTIMATE_ADVERSARIAL_CLAUSES[i].metadata.source}]`);
            console.log(`  Raw Text: "${rawText.substring(0, 80)}..."`);
            const score = r.risk_score || 0;
            let riskStr = score >= 8 ? `CRITICAL (${score}/10)` :
                          score >= 5 ? `MODERATE (${score}/10)` : `LOW (${score}/10)`;
            console.log(`  Risk Level: ${(r.risk_level || 'unknown').toUpperCase()}`);
            console.log(`  Risk Score: ${riskStr}`);
            console.log(`  Tier 2 Override: ${r.tier2_override ? 'YES' : 'NO'}`);
            console.log('  Risk Reasons:');
            if (r.risk_reasons && r.risk_reasons.length > 0) {
                 r.risk_reasons.forEach(reason => console.log(`   → ${reason}`));
            }
            console.log('  Law References:');
            if (r.possible_law_references && r.possible_law_references.length > 0) {
                 r.possible_law_references.forEach(ref => console.log(`   - ${ref.act_name || ref.act_key} | ${ref.section_hint} — ${ref.reason}`));
            } else {
                 console.log('   - None');
            }
            console.log('');
        }

        // 2. CITATION VERIFIER
        console.log('🔍 RUNNING CITATION VERIFIER...');
        for (let i = 0; i < aiResults.length; i++) {
            const refs = aiResults[i].possible_law_references || [];
            if (refs.length > 0) {
                const { verifiedRefs } = await verifyCitations(refs);
                
                verifiedRefs.forEach(v => {
                    const actName = v.act_name || v.act_key || 'Unknown';
                    const section = v.parsedSection || v.section_hint || 'N/A';
                    console.log(`  - Clause ${i} | ${actName} Section ${section}`);
                    console.log(`    Status: ${v.verification_status}`);
                    console.log(`    Note:   ${v.verification_note}`);
                });
            } else {
                console.log(`  - Clause ${i} | No law references to verify.`);
            }
        }

        // 3. CROSS-REF AUDITOR (AGENT 9)
        console.log('\\n🕵️ RUNNING AGENT 9 CROSS-REF AUDITOR...');
        await runCrossRefAudit(dummyContract._id);
        
        console.log('\\n═══════════════════════════════════════════════════════════════');
        console.log('✅ ULTIMATE TEST COMPLETE.');
        console.log('═══════════════════════════════════════════════════════════════\\n');

    } catch (err) {
        console.error('❌ Test failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB.');
        process.exit(0);
    }
}

runUltimateTest();
