require('dotenv').config();
const mongoose = require('mongoose');
const { runAgent2RiskAnalyst } = require('../src/services/agent2RiskAnalyst');
const { retrieveComplianceContext } = require('../src/services/lawRetrieverService');

async function testStateLawRetrieval() {
    console.log("===============================================================");
    console.log("⚖️  TESTING STATE-LEVEL RAG RETRIEVAL (MAHARASHTRA)");
    console.log("===============================================================\n");

    await mongoose.connect(process.env.MONGODB_URI);

    const testClause = {
        id: "maharera-test-1",
        text: "The Purchaser agrees to pay an advance booking amount equal to 25% of the total flat cost before any formal agreement for sale is executed or registered."
    };

    console.log(`Evaluating Clause: "${testClause.text}"`);
    console.log(`Expected Law Hit: MahaRERA Rule 4 (cap of 10% advance)`);

    const globalContext = {
        governingLaw: "Maharashtra",
        document_type: "Agreement for Sale"
    };

    console.log(`\n⏳ Fetching Statutes...`);
    testClause.retrieved_legal_context = await retrieveComplianceContext("Real Estate", "Advance Payment", testClause.text, "Maharashtra");
    console.log(`Statutes Found: ${testClause.retrieved_legal_context !== "No specific statutory framework mapped." ? "Yes" : "No"}`);

    console.log(`\n⏳ Running Agent 2 Risk Analyst...`);
    try {
        const results = await runAgent2RiskAnalyst([testClause], globalContext);
        const result = results[0];

        console.log(`\n📊 RESULTS:`);
        console.log(`Risk Level: ${result.risk_level}`);
        console.log(`Risk Score: ${result.risk_score}`);
        console.log(`Confidence: ${result.confidence_score}`);
        console.log(`Reasons:`);
        result.risk_reasons.forEach(r => console.log(` - ${r}`));
        
        console.log(`\n📚 Cited Laws:`);
        if (result.possible_law_references && result.possible_law_references.length > 0) {
            result.possible_law_references.forEach(ref => {
                console.log(` - Act: ${ref.act_name}`);
                console.log(`   Section: ${ref.section_hint}`);
            });
        } else {
            console.log(" - NONE FOUND!");
        }

    } catch (err) {
        console.error("Agent 2 failed:", err);
    }

    await mongoose.disconnect();
}

testStateLawRetrieval().catch(console.error);
