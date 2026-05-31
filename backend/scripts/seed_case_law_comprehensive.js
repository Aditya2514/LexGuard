require('dotenv').config();
const mongoose = require('mongoose');
const { generateEmbedding } = require('../src/services/embeddingService');
const CaseLaw = require('../src/models/CaseLaw');

async function seedLandmarkCaseLaws() {
    console.log("🚀 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);

    const cases = [
        {
            case_title: "Niranjan Shankar Golikari v. Century Spg. and Mfg. Co. Ltd.",
            citation: "AIR 1967 SC 1098",
            legal_domain: "labor_law",
            jurisdiction: "Supreme Court",
            year: 1967,
            summary: "Established that negative covenants operative during the period of employment are not regarded as restraint of trade under Section 27 of the Contract Act.",
            key_holdings: ["In-term non-competes are valid.", "Post-term non-competes are void."],
            tags: ["non_compete", "employment", "restraint of trade"]
        },
        {
            case_title: "Percept D'Mark (India) Pvt. Ltd. v. Zaheer Khan",
            citation: "AIR 2006 SC 3426",
            legal_domain: "general_contract_law",
            jurisdiction: "Supreme Court",
            year: 2006,
            summary: "Reiterated that a restrictive covenant extending beyond the term of the contract is void and cannot be enforced.",
            key_holdings: ["Post-contractual restraint is void under Section 27.", "Applies to agency and commercial contracts as well."],
            tags: ["non_compete", "commercial", "agency"]
        },
        {
            case_title: "Fateh Chand v. Balkishan Dass",
            citation: "AIR 1963 SC 1405",
            legal_domain: "general_contract_law",
            jurisdiction: "Supreme Court",
            year: 1963,
            summary: "Clarified Section 74 of the Contract Act regarding liquidated damages. Stated that the court will only award reasonable compensation not exceeding the penalty stipulated.",
            key_holdings: ["Penalty clauses cannot be enforced as is.", "Proof of actual loss is required unless it's impossible to prove."],
            tags: ["liquidated_damages", "penalty", "breach"]
        },
        {
            case_title: "Kailash Nath Associates v. Delhi Development Authority",
            citation: "(2015) 4 SCC 136",
            legal_domain: "general_contract_law",
            jurisdiction: "Supreme Court",
            year: 2015,
            summary: "Held that forfeiture of earnest money is only permissible if actual loss is suffered due to the breach.",
            key_holdings: ["Earnest money cannot be forfeited without proving loss under Section 74."],
            tags: ["forfeiture", "earnest_money", "damages"]
        },
        {
            case_title: "Sicpa India Limited v. Manas Pratim Baruah",
            citation: "Delhi High Court (2011)",
            legal_domain: "labor_law",
            jurisdiction: "Delhi",
            year: 2011,
            summary: "Held that employment training bonds are only enforceable to the extent of the actual, verifiable expenditure incurred by the employer on the employee's training.",
            key_holdings: ["Training bonds must reflect actual costs.", "Cannot include routine salary or administrative overheads."],
            tags: ["training_bond", "employment", "damages"]
        },
        {
            case_title: "Central Inland Water Transport Corp v. Brojo Nath Ganguly",
            citation: "AIR 1986 SC 1571",
            legal_domain: "labor_law",
            jurisdiction: "Supreme Court",
            year: 1986,
            summary: "Held that unconscionable and highly asymmetrical contracts, particularly those allowing termination without cause for permanent employees, are void under Section 23 of the Contract Act.",
            key_holdings: ["Unconscionable terms in standard form contracts are void.", "Strikes down arbitrary 'hire and fire' clauses."],
            tags: ["unconscionable", "termination", "public_policy"]
        },
        {
            case_title: "Pioneer Urban Land and Infrastructure Ltd. v. Govindan Raghavan",
            citation: "(2019) 5 SCC 725",
            legal_domain: "consumer_protection",
            jurisdiction: "Supreme Court",
            year: 2019,
            summary: "Ruled that one-sided clauses in builder-buyer agreements constitute an unfair trade practice.",
            key_holdings: ["Asymmetrical clauses favouring the drafter are unfair trade practices."],
            tags: ["real_estate", "asymmetry", "unfair_trade"]
        },
        {
            case_title: "TRF Ltd. v. Energo Engineering Projects Ltd.",
            citation: "(2017) 8 SCC 377",
            legal_domain: "dispute_resolution",
            jurisdiction: "Supreme Court",
            year: 2017,
            summary: "Held that a person who is ineligible to be an arbitrator (e.g., an employee or MD of one party) cannot nominate another person as arbitrator.",
            key_holdings: ["Unilateral appointment of arbitrators by an interested party is invalid."],
            tags: ["arbitration", "unilateral_appointment", "dispute"]
        },
        {
            case_title: "Perkins Eastman Architects DPC v. HSCC (India) Ltd.",
            citation: "(2020) 20 SCC 760",
            legal_domain: "dispute_resolution",
            jurisdiction: "Supreme Court",
            year: 2020,
            summary: "Expanded on TRF Ltd., ruling that a party having an exclusive right to appoint a sole arbitrator is invalid in law.",
            key_holdings: ["Exclusive right to appoint a sole arbitrator violates the Arbitration Act."],
            tags: ["arbitration", "sole_arbitrator", "dispute"]
        },
        {
            case_title: "Energy Watchdog v. CERC",
            citation: "(2017) 14 SCC 80",
            legal_domain: "general_contract_law",
            jurisdiction: "Supreme Court",
            year: 2017,
            summary: "Clarified the law on Force Majeure and frustration of contracts under Section 56 of the Contract Act. Financial hardship does not constitute force majeure.",
            key_holdings: ["Economic hardship or increased costs do not trigger Force Majeure.", "Force Majeure must be strictly construed."],
            tags: ["force_majeure", "frustration", "hardship"]
        },
        {
            case_title: "Satyabrata Ghose v. Mugneeram Bangur & Co.",
            citation: "AIR 1954 SC 44",
            legal_domain: "general_contract_law",
            jurisdiction: "Supreme Court",
            year: 1954,
            summary: "Foundational case on the doctrine of frustration under Section 56 of the Indian Contract Act.",
            key_holdings: ["Frustration applies when an act becomes unlawful or impossible.", "Does not apply if the event could have been anticipated."],
            tags: ["frustration", "impossibility", "contract_act"]
        }
    ];

    let ingested = 0;
    for (const c of cases) {
        const existing = await CaseLaw.findOne({ citation: c.citation });
        if (existing) {
            console.log(`Skipping ${c.citation} (Already exists)`);
            continue;
        }

        const semanticText = `Case: ${c.case_title} (${c.citation})\nDomain: ${c.legal_domain}\nHoldings: ${c.key_holdings.join(' ')}\nSummary: ${c.summary}`;
        const vector = await generateEmbedding(semanticText, 'search_document');

        if (vector && vector.length === 768) {
            await CaseLaw.create({
                ...c,
                embedding: vector
            });
            console.log(`✅ Ingested Case: ${c.case_title}`);
            ingested++;
        } else {
            console.error(`🚨 Failed to embed: ${c.case_title}`);
        }
    }

    console.log(`🎉 Successfully seeded ${ingested} new landmark cases.`);
    process.exit(0);
}

seedLandmarkCaseLaws();
