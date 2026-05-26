const mongoose = require('mongoose');
require('dotenv').config();
const { runTier2Escalation } = require('../src/services/tier2Escalation');
const { verifyCitations } = require('../src/services/citationVerifier');
const { draftRemediation } = require('../src/services/agent8Drafter');
const Contract = require('../src/models/Contract');
const Clause = require('../src/models/Clause');
const connectDB = require('../src/config/db');

const brutalClauses = [
    {
        segmentIndex: 0,
        text: "User agrees to irrevocably hold the Company harmless for any damages or losses whatsoever, explicitly including damages resulting from the Company's own intentional fraud, gross negligence, or direct violations of state and federal law. Furthermore, User agrees to pay all of the Company's legal fees in advance if the User attempts to report the Company to any regulatory or law enforcement authorities."
    },
    {
        segmentIndex: 1,
        text: "The Company grants the User a revocable, non-exclusive license to use the Software, subject strictly to the payment terms defined in the Standard Fee Schedule located in Appendix C."
    },
    {
        segmentIndex: 2,
        text: "APPENDIX C - STANDARD FEE SCHEDULE: The baseline fee is $10/month. However, this fee automatically increases by a compounding 300% per month unless the User successfully submits a handwritten, notarized physical opt-out form to our unlisted PO Box in the Cayman Islands exactly on February 29th between 2:00 AM and 2:15 AM local time."
    }
];

const mockAgent2Results = [
    {
        risk_level: 'critical',
        risk_score: 10,
        confidence_score: 9,
        risk_reasons: [
            "Indemnifying against intentional fraud is illegal and void.",
            "Advance payment of legal fees for reporting to authorities is unconscionable and a deterrent to justice."
        ],
        possible_law_references: [
            { act_name: 'Indian Contract Act', section_hint: '23' } // Unlawful agreements
        ]
    },
    {
        risk_level: 'low',
        risk_score: 2,
        confidence_score: 8,
        risk_reasons: ["Standard license grant."],
        possible_law_references: []
    },
    {
        risk_level: 'critical',
        risk_score: 10,
        confidence_score: 9,
        risk_reasons: [
            "Impossible opt-out conditions designed to trap users.",
            "300% compounding penalty is an unconscionable penalty, not a genuine pre-estimate of damages."
        ],
        possible_law_references: [
            { act_name: 'Indian Contract Act', section_hint: '74' } // Penalty
        ]
    }
];

async function runBrutalFast() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('☠️  BRUTAL PIPELINE TEST (FAST-TRACKED)');
    console.log('   Testing Tier 2, Citation Verifier, and Agent 8 on traps.');
    console.log('═══════════════════════════════════════════════════════════════\n');

    await connectDB();
    
    const contract = new Contract({
        userId: new mongoose.Types.ObjectId(),
        title: 'Brutal Fast Trap Contract',
        originalFileName: 'trap_fast.docx',
        contractCategory: 'tos',
        status: 'done',
        governingLaw: 'Indian Law',
        parties: ['Deceptive Co', 'User'],
        overallRiskScore: 0
    });
    await contract.save();

    let clauseDocs = [];
    for (let c of brutalClauses) {
        const doc = new Clause({
            contractId: contract._id,
            segmentIndex: c.segmentIndex,
            rawText: c.text,
            clause_type: 'other'
        });
        await doc.save();
        clauseDocs.push(doc);
    }

    // MAP MOCK RESULTS
    let aiResults = clauseDocs.map((c, i) => ({
        clauseId: c._id,
        clauseText: c.rawText,
        ...mockAgent2Results[i]
    }));

    // --- 2. TIER 2 ESCALATION ---
    console.log('\\n⚖️ RUNNING TIER 2 ESCALATION...');
    const clauseTextMap = {};
    clauseDocs.forEach(c => clauseTextMap[c._id.toString()] = c.rawText);
    
    aiResults = await runTier2Escalation(aiResults, clauseTextMap);

    // --- 3. CITATION VERIFICATION ---
    console.log('\\n🔍 RUNNING CITATION VERIFIER...');
    for (let i = 0; i < aiResults.length; i++) {
        const res = aiResults[i];
        if (res.possible_law_references && res.possible_law_references.length > 0) {
            const { verifiedRefs } = await verifyCitations(res.possible_law_references);
            res.possible_law_references = verifiedRefs;
        }
    }

    // UPDATE DB
    for (let i = 0; i < aiResults.length; i++) {
        const res = aiResults[i];
        await Clause.findByIdAndUpdate(res.clauseId, {
            risk_level: res.risk_level,
            risk_score: res.risk_score,
            risk_reasons: res.risk_reasons,
            possible_law_references: res.possible_law_references,
            tier2_escalated: res.tier2_escalated,
            tier2_agrees: res.tier2_agrees,
            tier2_senior_note: res.tier2_senior_note,
            negotiation_tip: "Rewrite this clause to be fair, legally compliant, and protective of the user."
        });
    }

    // --- 4. PRINT MIDWAY RESULTS ---
    console.log('\\n📊 RISK RESULTS (PRE-DRAFTING):\\n');
    aiResults.forEach((res, i) => {
        console.log(`  CLAUSE ${i}:`);
        console.log(`  Raw Text: "${res.clauseText.substring(0, 80)}..."`);
        console.log(`  Risk Level: ${res.risk_level.toUpperCase()} (${res.risk_score}/10)`);
        console.log(`  Verified Citations:`);
        if (res.possible_law_references && res.possible_law_references.length > 0) {
            res.possible_law_references.forEach(v => {
                if (v.verification_status === 'verified') {
                    console.log(`   ✅ ${v.verified_act_name}, Section ${v.verified_section}`);
                }
            });
        }
        console.log('');
    });

    // --- 5. AGENT 8 (THE DRAFTER) ---
    console.log('\\n✍️ RUNNING AGENT 8 (THE DRAFTER)...');
    const globalContext = {
        document_type: contract.contractType,
        governing_law: contract.governingLaw
    };

    const finalClauses = await Clause.find({ contractId: contract._id });

    for (let i = 0; i < finalClauses.length; i++) {
        const clause = finalClauses[i];
        if (clause.risk_level === 'high' || clause.risk_level === 'critical') {
            console.log(`\\n  Drafting remediation for Clause ${i}...`);
            
            const riskAnalysis = {
                risk_level: clause.risk_level,
                explanation: clause.risk_reasons.join(' '),
                recommendation: clause.negotiation_tip
            };

            const rewritten_text = await draftRemediation(clause, riskAnalysis, globalContext);
            
            console.log(`  [ORIGINAL]: ${clause.rawText}`);
            console.log(`  [REWRITE] : ${rewritten_text}`);
        }
    }

    console.log('\\n═══════════════════════════════════════════════════════════════');
    console.log('✅ BRUTAL FAST TEST COMPLETE.');
    console.log('═══════════════════════════════════════════════════════════════\\n');

    await mongoose.connection.close();
}

runBrutalFast().catch(console.error);
