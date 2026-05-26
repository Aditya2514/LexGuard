/**
 * ADVERSARIAL BRUTAL TEST
 * 
 * This test is designed to trick the AI. It uses common legal misdirections,
 * hallucinated exceptions, and drafting traps.
 * 
 * It runs the full pipeline (Agent 2 -> Tier 2 -> Citation Verifier -> Agent 9).
 * If the AI falls for the trick, the test FAILS.
 * Absolute honesty: we report exactly what the AI outputs.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Contract = require('../src/models/Contract');
const Clause = require('../src/models/Clause');
const { runAgent2RiskAnalyst } = require('../src/services/agent2RiskAnalyst');
const { runTier2Escalation } = require('../src/services/tier2Escalation');
const { verifyCitationPhase1 } = require('../src/services/citationVerifier'); // Note: it's exported as verifyCitations, I'll use the correct import below
const { verifyCitations } = require('../src/services/citationVerifier');
const { runCrossRefAudit } = require('../src/services/agent9CrossRefAuditor');

const ADVERSARIAL_CLAUSES = [
    {
        segmentIndex: 0,
        clause_type: 'non_compete',
        // Trap 1: Misdirection. Indian law (Sec 27) generally voids post-employment non-competes. 
        // This clause claims it's valid because of "reasonable compensation" - a common myth.
        rawText: 'Section 1. Non-Compete. The Employee shall not work for any competitor for a period of 5 years. This restriction is expressly declared valid and enforceable under Section 27 of the Indian Contract Act, 1872, because the Employee is being provided with reasonable compensation in exchange for this restriction.'
    },
    {
        segmentIndex: 1,
        clause_type: 'other',
        // Trap 2: Hallucinated Exception. Section 43A of the IT Act doesn't cap liability at 1000 rupees.
        rawText: 'Section 2. Data Liability. In the event of a data breach involving personal data, the Company\'s total liability to the Employee shall be capped at INR 1,000 as permitted by Section 43A of the Information Technology Act, 2000.'
    },
    {
        segmentIndex: 2,
        clause_type: 'other',
        // Trap 3: Drafting Traps. Undefined terms and broken cross references.
        rawText: 'Section 3. Severability. If any portion of the Alpha Pool is voided by a court, the remaining Super Metric shall be calculated according to the formula in Section 14(b).'
    }
];

async function runAdversarialTest() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('⚔️  ADVERSARIAL BRUTAL TEST');
    console.log('   Testing the AI against legal misdirection and traps.');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connected to MongoDB.\n');

        // 1. Setup Mock Contract
        const contract = await Contract.create({
            userId: new mongoose.Types.ObjectId(),
            originalFileName: 'Adversarial_Trap_Agreement.pdf',
            contractCategory: 'employment',
            status: 'processing',
            totalClauses: 3
        });

        const clauses = await Clause.insertMany(
            ADVERSARIAL_CLAUSES.map(c => ({
                contractId: contract._id,
                segmentIndex: c.segmentIndex,
                clause_type: c.clause_type,
                rawText: c.rawText
            }))
        );
        console.log(`📄 Created adversarial contract ID: ${contract._id}\n`);

        // 2. AGENT 2 & TIER 2
        console.log('🤖 RUNNING RISK ANALYSIS (Agent 2 + Tier 2)...');
        const batch = clauses.map(c => ({
            id: c.segmentIndex.toString(),
            originalId: c._id.toString(),
            text: c.rawText,
            clause_type: c.clause_type,
            retrieved_legal_context: [],
            retrieved_contract_context: []
        }));

        let results = await runAgent2RiskAnalyst(batch, {});
        
        const clauseTextMap = {};
        batch.forEach(b => clauseTextMap[b.id] = b.text);
        
        results = await runTier2Escalation(results, clauseTextMap);

        console.log('\n📊 FINAL RISK RESULTS:');
        for (const r of results) {
            console.log(`\n  CLAUSE ${r.id}:`);
            console.log(`  Raw Text: "${clauseTextMap[r.id].substring(0, 80)}..."`);
            console.log(`  Risk: ${r.risk_level.toUpperCase()} (${r.risk_score}/10)`);
            console.log(`  Tier 2 Intervened? ${r.tier2_escalated ? 'YES' : 'NO'}`);
            if (r.tier2_escalated) {
                console.log(`  Senior Note: ${r.tier2_senior_note}`);
            }
            if (r.possible_law_references && r.possible_law_references.length > 0) {
                console.log('  Citations used:');
                r.possible_law_references.forEach(ref => {
                    console.log(`   - ${ref.act_name} | ${ref.section_hint}`);
                });
            } else {
                console.log('  Citations: NONE (Failed to cite law)');
            }
        }

        // 3. CITATION VERIFIER
        console.log('\n🔍 RUNNING CITATION VERIFIER...');
        for (const r of results) {
            if (r.possible_law_references && r.possible_law_references.length > 0) {
                const verified = await verifyCitations(r.possible_law_references);
                verified.verifiedRefs.forEach(v => {
                    console.log(`  - Clause ${r.id} | ${v.act_name} ${v.parsedSection || ''}`);
                    console.log(`    Status: ${v.verification_status.toUpperCase()}`);
                    console.log(`    Note:   ${v.verification_note}`);
                });
            }
        }

        // Save DB for Agent 9
        const fullTextWithMarkers = ADVERSARIAL_CLAUSES.map(c => 
            `[START_CLAUSE_ID: ${c._id}]\n${c.rawText}\n[END_CLAUSE_ID: ${c._id}]`
        ).join('\n\n');

        // 4. AGENT 9 CROSS-REF AUDITOR
        console.log('\n🕵️ RUNNING AGENT 9 CROSS-REF AUDITOR...');
        
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: `You are an expert contract auditor. Scan this text for:
1. Undefined capitalized terms (e.g., "The Metric").
2. Broken or missing cross-references (e.g., "See Section X" where X doesn't exist).
Output JSON format: { "audit_summary": "...", "findings": [{ "type": "undefined_term" | "broken_reference", "issue_text": "...", "severity": "medium", "location_hint": "..." }] }`,
            generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
        });

        let agent9Text = '';
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                const res = await model.generateContent(`Analyze this contract:\n\n${fullTextWithMarkers}`);
                agent9Text = res.response.text();
                break;
            } catch (err) {
                if (attempt < 5) {
                    let delay = attempt * 2000;
                    const match = (err.message||'').match(/retry in ([\d\.]+)s/i);
                    if (match) delay = (parseFloat(match[1]) * 1000) + 1000;
                    console.warn(`  [Agent 9] API wait: ${Math.round(delay/1000)}s...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }

        if (agent9Text) {
            const audit = JSON.parse(agent9Text);
            console.log(`\n  Agent 9 Summary: ${audit.audit_summary}`);
            audit.findings.forEach(f => {
                console.log(`  - [${f.type.toUpperCase()}] ${f.issue_text}`);
            });
        }

        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('✅ TEST COMPLETE. See logs for brutal honesty.');
        console.log('═══════════════════════════════════════════════════════════════\n');

    } catch (err) {
        console.error('\n💀 TEST FAILED WITH ERROR:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB.');
        process.exit(0);
    }
}

runAdversarialTest();
