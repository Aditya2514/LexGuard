require('dotenv').config();
process.env.HUGGINGFACE_API_KEY = 'invalid_key';
process.env.LLM_PROVIDER = 'huggingface';

const { callLLM } = require('./src/services/aiClient.js');

async function testFallback() {
  console.log("Testing Hugging Face Integration with forced error...");
  
  const systemPrompt = `You are LexGuard, an AI legal risk and negotiation assistant that helps users understand and triage contract clauses.
You are not a lawyer and you do not provide legal advice.
Your job is to highlight potential areas where the clause may raise Indian law compliance concerns, specifically referencing the Acts, sections, and landmark cases provided in the retrieved legal context.

You must reply with valid JSON only, with this structure:
{
  "results": [
    {
      "id": "c1",
      "compliance_risk_level": "medium",
      "potential_issue_areas": ["..."],
      "human_review_strongly_recommended": true,
      "explanatory_note": "..."
    }
  ]
}`;

  const userContent = JSON.stringify({
    clauses: [{
      id: "test1",
      text: "The employee agrees to a 5-year post-termination non-compete.",
      clause_type: "non_compete"
    }]
  });

  try {
    const res = await callLLM({ systemPrompt, userContent, jsonMode: true });
    console.log("\nFinal Result from callLLM:");
    console.log(JSON.stringify(res, null, 2));
    
    if (res.results && res.results.length > 0 && res.results[0].compliance_risk_level) {
      console.log("\n✅ Fallback succeeded! Received valid compliance_risk_level.");
    } else {
      console.log("\n❌ Fallback failed! Expected compliance_risk_level field.");
    }
  } catch (e) {
    console.error("❌ Orchestrator threw an error instead of falling back:", e);
  }
}

testFallback();
