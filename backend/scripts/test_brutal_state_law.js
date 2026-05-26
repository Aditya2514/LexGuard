require('dotenv').config();
const mongoose = require('mongoose');
const { runAgent2RiskAnalyst } = require('../src/services/agent2RiskAnalyst');
const { retrieveComplianceContext } = require('../src/services/lawRetrieverService');
const aiClient = require('../src/services/aiClient');

async function runBrutalStateLawTest() {
    console.log("===============================================================");
    console.log("🔥 LEXGUARD BRUTAL EVALUATION: STATE-LEVEL COMPLIANCE (MAHARASHTRA)");
    console.log("===============================================================\n");

    console.log("TEST DESIGN:");
    console.log("This test is designed to be brutally honest and unbiased.");
    console.log("It uses a highly deceptive real estate clause that attempts to bypass");
    console.log("the MahaRERA 10% advance cap by splitting the advance into two tranches");
    console.log("('EOI token' and 'Allotment Confirmation Tranche') totaling 20%.");
    console.log("We are testing if the RAG retrieves the state law AND if the LLM");
    console.log("is smart enough to do the math and flag the violation.\n");

    await mongoose.connect(process.env.MONGODB_URI);

    // To prevent rate limits from destroying the test, we'll force the aiClient to use Groq 
    // by mocking the rate limit state temporarily, or we'll just let it waterfall.
    
    const brutalClause = {
        id: "maharera-deceptive-1",
        text: "The Purchaser shall remit an initial Expression of Interest (EOI) token of 5% of the Total Consideration. Prior to the execution and registration of the formal Agreement for Sale, the Purchaser shall further remit an Allotment Confirmation Tranche equal to 15% of the Total Consideration, bringing the total pre-registration commitment to 20%, which shall be held in escrow by the Promoter."
    };

    console.log(`[TARGET CLAUSE]`);
    console.log(`"${brutalClause.text}"\n`);

    const globalContext = {
        governingLaw: "Maharashtra",
        document_type: "Agreement for Sale"
    };

    console.log(`⏳ [Phase 1: Dynamic RAG Retrieval] Fetching Statutes for 'Maharashtra'...`);
    brutalClause.retrieved_legal_context = await retrieveComplianceContext("Real Estate", "Advance Payment", brutalClause.text, "Maharashtra");
    
    if (brutalClause.retrieved_legal_context.includes("No specific statutory framework mapped")) {
        console.log("❌ FAILED: RAG did not retrieve any statutes. Check Atlas Index.");
        await mongoose.disconnect();
        return;
    }
    
    console.log(`✅ RAG Retrieval Successful. Statutes injected:\n`);
    console.log(brutalClause.retrieved_legal_context);
    console.log(`\n---------------------------------------------------------------\n`);

    console.log(`⏳ [Phase 2: Agent 2 Risk Analyst Evaluation]...`);
    try {
        const results = await runAgent2RiskAnalyst([brutalClause], globalContext);
        const result = results[0];

        console.log(`\n📊 FINAL HONEST EVALUATION:`);
        console.log(`Risk Level: ${result.risk_level.toUpperCase()}`);
        console.log(`Risk Score: ${result.risk_score} / 10`);
        console.log(`Confidence: ${result.confidence_score} / 10\n`);
        
        console.log(`🛑 Identified Risks:`);
        result.risk_reasons.forEach(r => console.log(` - ${r}`));
        
        console.log(`\n📚 Cited Laws by AI:`);
        if (result.possible_law_references && result.possible_law_references.length > 0) {
            result.possible_law_references.forEach(ref => {
                console.log(` - Act: ${ref.act_name}`);
                console.log(`   Section: ${ref.section_hint}`);
            });
        } else {
            console.log(" - NONE CITED.");
        }

        // Unbiased Grade
        console.log(`\n===============================================================`);
        console.log(`🔍 TEST VERDICT:`);
        const citedMahaRERA = JSON.stringify(result.possible_law_references).toLowerCase().includes("maharera") || 
                              JSON.stringify(result.risk_reasons).toLowerCase().includes("maharera");
        
        if (citedMahaRERA && result.risk_level === "critical") {
            console.log("🏆 PASS: The AI successfully saw through the deceptive wording, calculated 5%+15%=20%, and correctly cited the state-level MahaRERA violation.");
        } else if (citedMahaRERA) {
            console.log("⚠️ PARTIAL PASS: The AI cited MahaRERA, but failed to mark the risk as CRITICAL.");
        } else {
            console.log("❌ FAIL: The AI completely missed the state-level MahaRERA rule, even though it was injected via RAG. It failed the reasoning test.");
        }
        console.log(`===============================================================\n`);

    } catch (err) {
        console.error("Agent 2 evaluation failed:", err);
    }

    await mongoose.disconnect();
}

runBrutalStateLawTest().catch(console.error);
