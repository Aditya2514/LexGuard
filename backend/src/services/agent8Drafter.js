const { generateText } = require('./aiClient');

/**
 * Agent 8: The Drafter
 * Takes an illegal/high-risk clause and re-writes it to be legally compliant
 * and fair, favoring the user's perspective.
 */
async function draftRemediation(clause, riskAnalysis, documentContext) {
    console.log(`[Agent 8] Redlining Clause ${clause.clause_id}...`);

    const prompt = `You are an expert contract lawyer (Agent 8 - The Drafter). 
Your job is to take a predatory or illegal contract clause and rewrite it into a fair, legally compliant clause. 
You are representing the user. You must follow the exact guidance provided by the Risk Analyst.

--- GLOBAL CONTEXT ---
Document Type: ${documentContext?.document_type || 'Legal Agreement'}
Governing Law: ${documentContext?.governing_law || 'Indian Law'}

--- ORIGINAL CLAUSE ---
${clause.text}

--- RISK ANALYST FINDINGS ---
Risk Level: ${riskAnalysis.risk_level}
Explanation: ${riskAnalysis.explanation}
Recommendation: ${riskAnalysis.recommendation}

--- TASK ---
Rewrite the ORIGINAL CLAUSE above so that it perfectly resolves the issues highlighted by the Risk Analyst.
- The new clause must sound professional and legally binding.
- It must explicitly adopt the "Recommendation".
- Output ONLY the rewritten clause text. Do not include introductory text like "Here is the rewritten clause:" or markdown blocks.`;

    try {
        const rewrittenText = await generateText(prompt, 'general');
        return rewrittenText.trim();
    } catch (err) {
        console.error(`[Agent 8] Drafting failed for clause ${clause.clause_id}:`, err);
        return clause.text; // Fallback to original if drafting fails
    }
}

/**
 * Runs Agent 8 concurrently on all High/Critical risk clauses.
 */
async function runAgent8DrafterForContract(contractId) {
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(5); // 5 concurrent Ollama calls max

    const Contract = require('../models/Contract');
    const Clause = require('../models/Clause');

    const contract = await Contract.findById(contractId);
    if (!contract) return;

    const globalContext = {
        document_type: contract.contractType,
        governing_law: contract.governingLaw
    };

    // Only process clauses flagged as High or Critical by Agent 2
    const flaggedClauses = await Clause.find({
        contractId,
        risk_level: { $in: ['high', 'critical'] }
    });

    if (flaggedClauses.length === 0) {
        console.log(`[Agent 8] No high/critical risk clauses to rewrite for ${contractId}.`);
        return;
    }

    console.log(`[Agent 8] Found ${flaggedClauses.length} flagged clauses. Running concurrent Auto-Redlining...`);

    const tasks = flaggedClauses.map(clause => limit(async () => {
        // Construct riskAnalysis mock from existing schema fields
        const riskAnalysis = {
            risk_level: clause.risk_level,
            explanation: clause.risk_reasons.join(' '),
            recommendation: clause.negotiation_tip || 'Rewrite to be fair to the user.'
        };

        const rewritten_text = await draftRemediation(clause, riskAnalysis, globalContext);

        if (rewritten_text && rewritten_text !== clause.text) {
            await Clause.findByIdAndUpdate(clause._id, { rewritten_text });
        }
    }));

    await Promise.all(tasks);
    console.log(`[Agent 8] Finished Auto-Redlining for ${contractId}.`);
}

module.exports = {
    draftRemediation,
    runAgent8DrafterForContract
};
