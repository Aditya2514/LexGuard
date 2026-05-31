const { callLLM } = require('./aiClient');

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

--- VERIFIED LEGAL CITATIONS ---
${clause.possible_law_references && clause.possible_law_references.length > 0
    ? clause.possible_law_references
        .filter(ref => ref.verification_status === 'verified')
        .map(ref => `- ${ref.verified_act_name || ref.act_name}, Section ${ref.verified_section || ref.section_hint}\n  Analysis: ${ref.reason}`)
        .join('\n')
    : 'No verified statutory citations provided. Rely on general fair commercial principles.'
}

--- TASK ---
Rewrite the ORIGINAL CLAUSE above so that it perfectly resolves the issues highlighted by the Risk Analyst.
- The new clause must sound professional and legally binding.
- It must explicitly adopt the "Recommendation" and comply with any "Verified Legal Citations" provided.
- You MUST output ONLY valid JSON in the following format:
  {
    "rewritten_text": "The fully rewritten clause text here"
  }`;

    try {
        const response = await callLLM({
            systemPrompt: 'You are an expert Indian contract drafter. Always output valid JSON.',
            userContent: prompt,
            jsonMode: true,
            temperature: 0.2, // Drafting requires precision
            maxTokens: 1024,
            providerOverride: 'gemini' // Explicitly force the more capable model for legal drafting
        });
        
        let rewrittenText = '';
        if (response && response.rewritten_text) {
            rewrittenText = response.rewritten_text;
        } else if (typeof response === 'object' && response.results) {
            rewrittenText = response.results[0] || response.text || '';
        }

        return typeof rewrittenText === 'string' && rewrittenText.length > 0 ? rewrittenText.trim() : clause.text;
    } catch (err) {
        console.error(`[Agent 8] Drafting failed for clause ${clause.clause_id || clause._id}:`, err);
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
