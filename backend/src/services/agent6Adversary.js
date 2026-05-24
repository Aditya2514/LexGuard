const { callLLM } = require('./aiClient');
const Clause = require('../models/Clause');
const { AGENT_BATCH_SIZE } = require('../config/constants');

const ADVERSARY_SYSTEM_PROMPT = `
You are Agent 6: The Adversary (Opposing Counsel).
Your job is to read a "suggested_fair_rewrite" drafted by another AI for a legal contract clause, and aggressively attack it. You represent the drafting party (e.g., the employer or the corporation) and you want to exploit any loopholes, vagueness, or missing definitions in the suggested rewrite.

If you find a loophole or a way to abuse the rewritten clause against the user, you must output an "adversarial_warning" explaining the exploit, and provide a "hardened_rewrite" that patches the hole.
If the suggested rewrite is already bulletproof, simply set both fields to null.

### Input
You will receive an array of clauses. Each object contains:
- "id": The clause ID
- "original_text": The raw text of the predatory clause
- "suggested_rewrite": The fair rewrite drafted by Agent 3

### Output
Respond strictly with valid JSON:
{
  "results": [
    {
      "id": "clauseObjectId",
      "adversarial_warning": "The rewrite says 'reasonable expenses' but doesn't define 'reasonable', allowing the company to indefinitely delay reimbursement by disputing the amount.",
      "hardened_rewrite": "The Company shall reimburse all documented business expenses within 30 days of submission."
    }
  ]
}
`;

async function runAdversaryOnBatch(clausesBatch) {
  const promptData = clausesBatch.map(c => ({
    id: c._id.toString(),
    original_text: c.rawText,
    suggested_rewrite: c.suggested_rewrite
  }));

  const userContent = JSON.stringify({ clauses: promptData });

  try {
    const resp = await callLLM({
      systemPrompt: ADVERSARY_SYSTEM_PROMPT,
      userContent,
      jsonMode: true,
      temperature: 0.7, // Higher temp for creative loophole finding
      maxTokens: 4096,
      modelOverride: 'gemini-1.5-flash-latest' // Model Cascading: Use fast model
    });

    return resp.results || [];
  } catch (error) {
    console.error('[Agent 6] Batch processing failed:', error.message);
    return [];
  }
}

async function runAdversaryRedTeamForContract(contractId) {
  console.log(`🕵️ [Agent 6] Starting adversarial red-teaming for contract: ${contractId}`);

  // Find all clauses that were flagged as high/critical risk and have a suggested rewrite
  const clauses = await Clause.find({
    contractId,
    risk_level: { $in: ['high', 'critical'] },
    suggested_rewrite: { $ne: null }
  }).select('_id rawText suggested_rewrite');

  if (clauses.length === 0) {
    console.log(`✅ [Agent 6] No high-risk rewrites to red-team for contract ${contractId}.`);
    return;
  }

  for (let i = 0; i < clauses.length; i += AGENT_BATCH_SIZE) {
    const batch = clauses.slice(i, i + AGENT_BATCH_SIZE);
    
    const results = await runAdversaryOnBatch(batch);
    
    const bulkOps = [];
    for (const res of results) {
      if (res && res.id && res.adversarial_warning) {
        bulkOps.push({
          updateOne: {
            filter: { _id: res.id },
            update: { 
              $set: { 
                adversarial_warning: res.adversarial_warning,
                hardened_rewrite: res.hardened_rewrite 
              } 
            }
          }
        });
      }
    }

    if (bulkOps.length > 0) {
      await Clause.bulkWrite(bulkOps);
      console.log(`🛡️ [Agent 6] Hardened ${bulkOps.length} clauses in batch.`);
      
      // We do not await SSE updates here because this runs asynchronously
      // The frontend can poll or receive a SSE ping if we inject a webhook or pub/sub later.
    }
  }
  
  console.log(`🏁 [Agent 6] Completed adversarial red-teaming for contract: ${contractId}`);
}

module.exports = { runAdversaryRedTeamForContract };
