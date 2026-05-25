const mongoose = require('mongoose');
const { callLLM } = require('./aiClient');
const Contract = require('../models/Contract');
const Clause = require('../models/Clause');

const SYSTEM_PROMPT = `You are a forensic financial auditor. Your only job is to extract explicit financial obligations, penalties, clawbacks, training bond fees, and hidden costs from the text. 
Ignore standard salary or base compensation.

Output a strictly formatted JSON array of objects. Do not include any conversational text or markdown blocks outside the JSON array.
Format:
[
  {
    "amount": 5000,
    "currency": "USD",
    "description": "Penalty for early termination of the training bond.",
    "clause_id": "optional clause object id if known"
  }
]

If no financial obligations are found, return an empty array: []
`;

/**
 * Extracts financial obligations from the contract using Agent 4.
 * This runs as a sidecar process in the queue.
 */
async function runAgent4FinancialAnalyst(contractId) {
  try {
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    const clauses = await Clause.find({ contractId }).lean();
    if (clauses.length === 0) return;

    // Send chunks to LLM or whole contract if small enough
    const contractText = clauses.map(c => `[ID: ${c._id.toString()}] ${c.rawText}`).join('\n\n');
    
    // Safety limit on text size (e.g., truncate if excessively large for a single pass, or batch it)
    const prompt = `Extract financial obligations from the following contract:\n\n${contractText}`;

    // Force JSON output
    let extractedData = await callLLM({
      systemPrompt: SYSTEM_PROMPT,
      userContent: prompt,
      jsonMode: true
    });

    if (!Array.isArray(extractedData)) {
      // If it returned an object with a wrapper key like { "results": [...] } or similar
      if (extractedData.financial_obligations && Array.isArray(extractedData.financial_obligations)) {
        extractedData = extractedData.financial_obligations;
      } else if (extractedData.obligations && Array.isArray(extractedData.obligations)) {
        extractedData = extractedData.obligations;
      } else {
        extractedData = [];
      }
    }

    let totalExposure = 0;
    const financial_obligations = extractedData.map(item => {
      totalExposure += (Number(item.amount) || 0);
      
      const ob = {
        amount: Number(item.amount) || 0,
        currency: item.currency || 'INR',
        description: item.description || 'Financial Obligation'
      };
      
      if (item.clause_id && mongoose.Types.ObjectId.isValid(item.clause_id)) {
        ob.clause_id = new mongoose.Types.ObjectId(item.clause_id);
      }
      return ob;
    });

    // Save to contract
    await Contract.findByIdAndUpdate(contractId, {
      financial_obligations,
      total_financial_exposure: totalExposure
    });

    console.log(`[Agent 4] Financial Analyst found ${financial_obligations.length} obligations, total exposure: ${totalExposure}.`);

  } catch (err) {
    console.error(`[Agent 4] Financial Analyst failed: ${err.message}`);
    // Do not throw, as this is a sidecar process and should not kill the job pipeline
  }
}

module.exports = {
  runAgent4FinancialAnalyst
};
