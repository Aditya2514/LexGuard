require('dotenv').config();
const { runAgent4ComplianceChecker } = require('./src/services/agent4ComplianceChecker.js');

async function test() {
  const clausesBatch = [{
    id: "6a0b1e43abbf9fbd1ef9c951",
    text: "3. NON-COMPETE CLAUSE: The Employee shall not compete, directly or indirectly, for a period of three years after termination of employment in any territory worldwide.",
    clause_type: "non_compete",
    risk_level: "critical",
    risk_score: 10,
    retrieved_legal_context: [
      {
        act_key: "INDIAN_CONTRACT_ACT",
        act_name: "Indian Contract Act, 1872",
        section_number: "27",
        title: "Agreement in restraint of trade, void",
        content: "Every agreement by which anyone is restrained from exercising a lawful profession, trade or business of any kind, is to that extent void."
      }
    ]
  }];
  
  console.log("Calling Agent 4...");
  const results = await runAgent4ComplianceChecker(clausesBatch);
  console.log("Agent 4 Results:");
  console.log(JSON.stringify(results, null, 2));
}

test().catch(console.error);
