/**
 * Tier 2 Escalation Service
 * 
 * When Agent 2 flags a clause as high-risk or uncertain, this service
 * re-analyses it using a more powerful model (Gemini 2.5 Flash) for
 * deeper legal reasoning. Think of it as a "senior partner review"
 * triggered automatically on hard cases.
 * 
 * Escalation Criteria:
 *   - risk_score >= 7 (high/critical findings need confirmation)
 *   - confidence_score <= 4 (the model itself is uncertain)
 *   - risk_level is 'high' or 'critical'
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Tier 2 System Prompt ─────────────────────────────────────────────────────

const TIER2_SYSTEM_PROMPT = `You are a Senior Legal Compliance Auditor for Indian contracts. You are reviewing the work of a junior analyst who has already flagged potential risks in contract clauses.

Your role is to provide a SECOND OPINION. You will receive:
1. The original clause text
2. The junior analyst's initial assessment (risk level, score, and reasons)

Your task:
- If you AGREE with the junior analyst: confirm the assessment and optionally refine the reasoning.
- If you DISAGREE (the junior analyst over-rated or under-rated the risk): provide your corrected assessment with detailed reasoning.
- You MUST cite specific Indian statutes by Act name AND section number when applicable.

### Output Format (JSON only):
{
  "results": [
    {
      "id": <clause_id>,
      "tier2_agrees": true/false,
      "risk_level": "low" | "medium" | "high" | "critical",
      "risk_score": 1-10,
      "confidence_score": 1-10,
      "risk_reasons": ["reason1", "reason2"],
      "possible_law_references": [
        {
          "act_key": "INDIAN_CONTRACT_ACT",
          "act_name": "Indian Contract Act, 1872",
          "section_hint": "Section 27 - Restraint of trade",
          "reason": "Brief explanation"
        }
      ],
      "senior_note": "A brief explanation of why you agree or disagree with the junior analyst."
    }
  ]
}

### Rules:
- risk_level: one of "low", "medium", "high", "critical"
- risk_score: integer 1-10
- confidence_score: 1-10 (YOUR confidence in this assessment)
- Always include section numbers when citing Indian law
- Be precise and legally grounded. Do not speculate.
- If you lack information to assess, set confidence_score to 3 and note this in senior_note.
`;

// ── Core Escalation Logic ────────────────────────────────────────────────────

/**
 * Determines if a clause result needs Tier 2 escalation.
 */
function needsEscalation(result) {
    const score = parseInt(result.risk_score, 10) || 5;
    const confidence = parseInt(result.confidence_score, 10) || 5;
    const level = (result.risk_level || 'medium').toLowerCase();

    return (
        score >= 7 ||
        confidence <= 4 ||
        level === 'high' ||
        level === 'critical'
    );
}

/**
 * Run Tier 2 escalation on a batch of clause results.
 * Only processes clauses that meet the escalation criteria.
 * 
 * @param {Array} clauseResults - Agent 2's results for clauses
 * @param {Object} clauseTextMap - Map of clause ID -> raw text
 * @returns {Array} Updated results with Tier 2 overrides applied
 */
async function runTier2Escalation(clauseResults, clauseTextMap) {
    // Filter for clauses that need escalation
    const escalationCandidates = clauseResults.filter(r => needsEscalation(r));

    if (escalationCandidates.length === 0) {
        console.log('[Tier 2] No clauses met escalation criteria. Skipping.');
        return clauseResults;
    }

    console.log(`[Tier 2] Escalating ${escalationCandidates.length}/${clauseResults.length} clauses for senior review.`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('[Tier 2] GEMINI_API_KEY not set. Skipping escalation.');
        return clauseResults;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Build the prompt with clause texts and junior analyst findings
    const escalationPayload = escalationCandidates.map(r => ({
        id: r.id,
        clause_text: clauseTextMap[r.id] || 'Text unavailable',
        junior_assessment: {
            risk_level: r.risk_level,
            risk_score: r.risk_score,
            confidence_score: r.confidence_score,
            risk_reasons: r.risk_reasons,
            possible_law_references: r.possible_law_references,
        }
    }));

    const userContent = JSON.stringify({ clauses_for_review: escalationPayload });

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: TIER2_SYSTEM_PROMPT,
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });

        let text = '';
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                const result = await model.generateContent(userContent);
                const response = result.response;
                
                try { text = response.text(); } catch {}
                if (!text && response.candidates && response.candidates[0]) {
                    const parts = response.candidates[0].content?.parts || [];
                    for (const part of parts) {
                        if (part.text) text = part.text;
                    }
                }
                break; // Success! Break out of the retry loop.
            } catch (err) {
                const errMessage = err.message || '';
                const isTransient = errMessage.includes('503') || errMessage.includes('quota') || errMessage.includes('timeout') || errMessage.includes('429');
                
                if (attempt < 5 && isTransient) {
                    let delayMs = attempt * 2000; // default backoff
                    
                    // Intelligent Quota Wait: "Please retry in 39.2s"
                    const retryMatch = errMessage.match(/retry in ([\d\.]+)s/i);
                    if (retryMatch && retryMatch[1]) {
                        delayMs = (parseFloat(retryMatch[1]) * 1000) + 1000; // Add 1s buffer
                    }
                    
                    console.warn(`[Tier 2] Gemini transient error (attempt ${attempt}/5), retrying in ${Math.round(delayMs/1000)}s...`);
                    await new Promise(r => setTimeout(r, delayMs));
                } else {
                    throw err; // Out of retries or non-transient error
                }
            }
        }

        if (!text) {
            console.warn('[Tier 2] Empty response from Gemini. Keeping original results.');
            return clauseResults;
        }

        // Parse JSON from the response
        let tier2Results;
        try {
            // Try direct parse
            tier2Results = JSON.parse(text);
        } catch {
            // Try extracting from markdown fences
            const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
            if (fenced) {
                try { tier2Results = JSON.parse(fenced[1].trim()); } catch {}
            }
            // Try finding JSON object
            if (!tier2Results) {
                const firstBrace = text.indexOf('{');
                const lastBrace = text.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                    try { tier2Results = JSON.parse(text.substring(firstBrace, lastBrace + 1)); } catch {}
                }
            }
        }

        if (!tier2Results || !tier2Results.results) {
            console.warn('[Tier 2] Could not parse response. Keeping original results.');
            return clauseResults;
        }

        // Merge Tier 2 results back into the original results
        const tier2Map = {};
        for (const t2 of tier2Results.results) {
            tier2Map[t2.id] = t2;
        }

        const mergedResults = clauseResults.map(original => {
            const t2 = tier2Map[original.id];
            if (!t2) return original;

            console.log(
                `   [Tier 2] Clause ${original.id}: ` +
                `${t2.tier2_agrees ? '✅ Confirmed' : '🔄 Overridden'} → ` +
                `${t2.risk_level} (${t2.risk_score}/10) | ${t2.senior_note?.substring(0, 80) || ''}`
            );

            return {
                ...original,
                // Use Tier 2's assessment
                risk_level: t2.risk_level || original.risk_level,
                risk_score: t2.risk_score != null ? t2.risk_score : original.risk_score,
                confidence_score: t2.confidence_score != null ? t2.confidence_score : original.confidence_score,
                risk_reasons: t2.risk_reasons || original.risk_reasons,
                possible_law_references: t2.possible_law_references || original.possible_law_references,
                // Tier 2 metadata
                tier2_escalated: true,
                tier2_agrees: t2.tier2_agrees,
                tier2_senior_note: t2.senior_note || null,
            };
        });

        const agreements = tier2Results.results.filter(r => r.tier2_agrees).length;
        const overrides = tier2Results.results.filter(r => !r.tier2_agrees).length;
        console.log(`[Tier 2] Complete: ${agreements} confirmed, ${overrides} overridden.`);

        return mergedResults;

    } catch (err) {
        console.error(`[Tier 2] Escalation failed: ${err.message}. Keeping original results.`);
        return clauseResults;
    }
}

module.exports = { runTier2Escalation, needsEscalation };
