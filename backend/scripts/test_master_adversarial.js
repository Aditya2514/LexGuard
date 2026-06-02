require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Contract = require('../src/models/Contract');
const Clause = require('../src/models/Clause');
const { processContractJob, awaitShutdown } = require('../src/services/jobQueueService');

async function runMasterTest() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB.");

    // Create 80k chars of junk
    const junkText = "This is standard boilerplate text designed to pad the document and push the Map-Reduce boundary. ".repeat(800);

    const rawContractText = `
EMPLOYMENT AND CONFIDENTIALITY AGREEMENT

This Agreement is made on 2024-01-15 by and between Deceptive Corp ("Company") having its registered office at Bengaluru, Karnataka, and John Doe ("Employee").

RECITALS
The Company is engaged in software development. The Employee will be operating out of a residential zone.

${junkText}

SCHEDULE 1: DEFINITIONS
"Confidential Information" means all trade secrets.
"Competitor" means any business globally.

CLAUSE 4: NON-COMPETE
The Employee agrees that for a period of 24 months following the termination of this Agreement for any reason, they shall not engage, directly or indirectly, in any capacity for any Competitor globally.

CLAUSE 5: MUNICIPAL COMPLIANCE
The Employee acknowledges that the Company's software development activities are conducted from a residential zone in Bengaluru.

CLAUSE 6: JURISDICTION OBFUSCATION
In the event of any disagreement, the exclusive venue for conflict resolution shall be the subterranean chambers of the High Court of Antarctica, and the Employee explicitly waives all rights to seek redress in any recognized Indian forum.

CLAUSE 7: HALLUCINATED PENALTY
If the Employee violates any term, they shall forfeit all past wages under Section 19(4) of the Indian Contract Act.

IN WITNESS WHEREOF, the parties have signed this Agreement.
`;

    const contract = new Contract({
        userId: new mongoose.Types.ObjectId(), // Fake user ID
        title: 'Master Adversarial Test Contract',
        originalFileName: 'master_test.txt',
        contractCategory: 'employment',
        status: 'processing',
        governingLaw: 'India / Bengaluru',
        rawText: rawContractText,
    });
    
    // Split into clauses as the router does
    const { splitClauses } = require('../src/services/clauseSplitter');
    const clauseSegments = splitClauses(rawContractText);
    contract.totalClauses = clauseSegments.length;
    await contract.save();
    
    const clauseDocs = clauseSegments.map((seg) => ({
        contractId: contract._id,
        segmentIndex: seg.segmentIndex,
        rawText: seg.rawText,
    }));
    await Clause.insertMany(clauseDocs);
    console.log("📦 Contract Saved with", clauseDocs.length, "clauses:", contract._id);

    console.log("🚀 Running Full Processing Pipeline via JobQueueService...");
    await processContractJob(contract._id);

    console.log("✅ Processing complete. Fetching results...");

    const clauses = await Clause.find({ contractId: contract._id }).sort({ segmentIndex: 1 });
    console.log("\n==================================================");
    console.log("EXTRACTED CLAUSES AND RISK RESULTS");
    console.log("==================================================");
    for (const c of clauses) {
        console.log(`\nClause ${c.segmentIndex} [${c.clause_type}]: ${c.rawText.substring(0, 100)}...`);
        console.log(`Risk: ${c.risk_level} (${c.risk_score}/10) | Compliance Risk: ${c.compliance_risk_level}`);
        if (c.tier2_escalated) {
            console.log(`Tier 2 Esc: ${c.tier2_escalated}, Senior Note: ${c.tier2_senior_note}`);
        }
        if (c.risk_reasons && c.risk_reasons.length > 0) {
            console.log(`Reasons: ${c.risk_reasons.join(' | ')}`);
        }
        if (c.possible_law_references && c.possible_law_references.length > 0) {
            console.log("Citations:");
            c.possible_law_references.forEach(ref => {
                console.log(` - ${ref.act_name}, Section ${ref.section_hint} [Status: ${ref.verification_status}]`);
            });
        }
        if (c.negotiation_tip) {
            console.log(`Drafted Rewrite:\n${c.negotiation_tip}`);
        }
    }

    await awaitShutdown(); // Let Agent 6 finish gracefully
    await mongoose.disconnect();
}
runMasterTest().catch(console.error);
