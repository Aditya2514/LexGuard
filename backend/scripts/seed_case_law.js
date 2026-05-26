require('dotenv').config();
const mongoose = require('mongoose');
const { seedCaseLaw } = require('../src/services/ragCaseLawService');

const LANDMARK_CASES = [
    {
        case_title: "Niranjan Shankar Golikari v. Century Spinning and Mfg. Co. Ltd.",
        citation: "1967 AIR 1098, 1967 SCR (2) 378",
        legal_domain: "general_contract_law",
        summary: "The Supreme Court held that a negative covenant restraining an employee from working elsewhere during the term of the contract is valid and does not amount to a restraint of trade under Section 27 of the Indian Contract Act."
    },
    {
        case_title: "Percept D'Mark (India) Pvt. Ltd. v. Zaheer Khan",
        citation: "2006 (4) SCC 227",
        legal_domain: "general_contract_law",
        summary: "The Supreme Court held that post-contractual restrictive covenants (non-compete clauses after termination of employment or contract) are void and unenforceable under Section 27 of the Indian Contract Act."
    },
    {
        case_title: "Central Inland Water Transport Corporation v. Brojo Nath Ganguly",
        citation: "1986 AIR 1571, 1986 SCR (3) 156",
        legal_domain: "labor_law",
        summary: "The Supreme Court struck down a clause giving the employer the right to terminate permanent employees with three months' notice without assigning reasons, ruling it void under Section 23 of the Contract Act as being unconscionable, arbitrary, and opposed to public policy."
    },
    {
        case_title: "LIC of India v. Consumer Education and Research Centre",
        citation: "1995 AIR 1811, 1995 SCC (5) 482",
        legal_domain: "general_contract_law",
        summary: "The Supreme Court ruled that terms in a contract of adhesion (standard form contract) are subject to judicial review and can be struck down if they are unreasonable, unfair, or lack mutuality, especially when one party has significantly greater bargaining power."
    },
    {
        case_title: "Bharat Aluminium Co. v. Kaiser Aluminium Technical Services Inc. (BALCO)",
        citation: "2012 (9) SCC 552",
        legal_domain: "arbitration_law",
        summary: "The Supreme Court established the territoriality principle in arbitration, holding that Part I of the Arbitration and Conciliation Act (interim reliefs) does not apply to foreign-seated arbitrations, prioritizing party autonomy in selecting the seat."
    }
];

async function executeCaseLawSeeding() {
    console.log("🚀 Connecting to MongoDB to Seed Landmark Case Laws...");
    await mongoose.connect(process.env.MONGODB_URI);

    let success = 0;
    for (const caseData of LANDMARK_CASES) {
        try {
            await seedCaseLaw(
                caseData.case_title,
                caseData.citation,
                caseData.legal_domain,
                caseData.summary
            );
            success++;
        } catch (err) {
            console.error(`🚨 Failed to seed ${caseData.case_title}:`, err.message);
        }
    }

    console.log(`\n⚖️ Successfully seeded ${success}/${LANDMARK_CASES.length} landmark Indian cases into the RAG system.`);
    process.exit(0);
}

executeCaseLawSeeding();
