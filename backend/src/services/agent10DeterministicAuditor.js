const { callLLM } = require('./aiClient');
const Contract = require('../models/Contract');
const Clause = require('../models/Clause');
const vm = require('vm');

const DYNAMIC_EXTRACTION_PROMPT = `
You are Agent 10 (The Deterministic Code Interpreter) for LexGuard.
Your objective is to catch hard mathematical, financial, and chronological contradictions in the provided contract.
You must output a strictly formatted JSON object containing two fields:
1. "extracted_data": A dictionary of all exact numerical, temporal, or financial parameters found in the contract.
2. "validation_code": A raw JavaScript string defining a function 'validate(data)' that evaluates the 'extracted_data' for logical contradictions.

Requirements for 'validation_code':
- It must take one argument: 'data' (which corresponds to extracted_data).
- It must return an array of risk objects: [{ severity: 'critical' | 'high' | 'medium', title: '...', reason: '...' }]
- You must write pure Javascript (ES6 allowed).
- Do NOT use markdown code blocks inside the 'validation_code' string. Just raw valid JavaScript text.

Output Schema:
{
  "extracted_data": { ... },
  "validation_code": "function validate(data) { const risks = []; /* your logic */ return risks; }"
}
`;

async function runAgent10DeterministicAudit(contractId) {
    console.log(`[Agent 10] Starting Dynamic Code Interpreter for contract: ${contractId}`);

    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    const clauses = await Clause.find({ contractId }).sort('segmentIndex');
    const fullText = clauses.map(c => c.rawText).join('\n\n');

    // Step 1: LLM Dynamic Code Generation Pass
    const llmResult = await callLLM({
        systemPrompt: DYNAMIC_EXTRACTION_PROMPT,
        userContent: JSON.stringify({ contractText: fullText }),
        jsonMode: true,
        temperature: 0.1, 
        maxTokens: 4000
    });

    const data = llmResult.parsed;
    let newRisksCount = 0;

    const pushRisk = async (severity, reason, title) => {
        const newRisk = new Clause({
            contractId,
            segmentIndex: 9999 + newRisksCount,
            rawText: `[DETERMINISTIC VALIDATION FAILURE] ${title}`,
            analysis_status: 'completed',
            risk_level: severity,
            compliance_risk: severity,
            reasons: [reason],
            agent_source: 'Agent10'
        });
        await newRisk.save();
        newRisksCount++;
        console.log(`🚨 [Agent 10] Dynamic Risk Found: ${title}`);
    };

    // Step 2: Sandboxed Node.js VM Execution
    if (data?.validation_code && data?.extracted_data) {
        try {
            console.log(`[Agent 10] Executing dynamic validation script in sandbox...`);
            // Wrap the function in an IIFE to execute it immediately with the extracted data
            const scriptStr = `
                (${data.validation_code})(${JSON.stringify(data.extracted_data)});
            `;
            
            const script = new vm.Script(scriptStr);
            // Create an empty context to prevent access to Node internals
            const context = vm.createContext({});
            
            // Execute the script with a 2-second timeout to prevent infinite loops
            const generatedRisks = script.runInContext(context, { timeout: 2000 });
            
            if (Array.isArray(generatedRisks)) {
                for (const risk of generatedRisks) {
                    await pushRisk(
                        risk.severity || 'high',
                        risk.reason || 'Dynamic deterministic constraint violation detected.',
                        risk.title || 'Validation Logic Error'
                    );
                }
            } else {
                console.warn(`[Agent 10] Validation script returned non-array result:`, generatedRisks);
            }
        } catch (err) {
            console.error(`⚠️ [Agent 10] Dynamic VM Execution Failed: ${err.message}`);
        }
    } else {
        console.warn(`[Agent 10] LLM did not return proper validation_code or extracted_data fields.`);
    }

    console.log(`✅ [Agent 10] Dynamic Audit completed. Found ${newRisksCount} contradictions.`);
}

module.exports = { runAgent10DeterministicAudit };
