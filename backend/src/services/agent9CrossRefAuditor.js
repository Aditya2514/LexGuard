/**
 * Agent 9: Cross-Reference Auditor
 * 
 * Scans the entire contract text to find broken cross-references,
 * undefined capitalized terms, and circular dependencies. This solves
 * a major source of contract ambiguity and downstream legal risk.
 */

const callLLM = require('./aiClient');
const Contract = require('../models/Contract');
const Clause = require('../models/Clause');

const AGENT9_SYSTEM_PROMPT = `You are Agent 9, LexGuard's Cross-Reference Auditor and Defined Terms Checker.
Your job is to meticulously scan the entire contract for drafting errors related to cross-references and definitions.

### Audit Targets:
1. Undefined Capitalized Terms: Words like "The Vendor" or "the Confidential Information" that are used but never explicitly defined in a definitions section.
2. Broken Cross-References: Clauses that refer to "Section 4(b)" when no such section exists, or refer to "Exhibit A" when it is missing.
3. Circular Definitions: E.g., "Term means the duration specified in the Term Sheet" when the Term Sheet says "Duration as defined in the Term".
4. Conflicting Clauses: Two clauses that contradict each other (e.g., Clause 5 says net-30 days, Clause 12 says net-60 days).

### Output Format (JSON Only):
{
  "cross_ref_findings": [
    {
      "type": "undefined_term" | "broken_reference" | "circular_definition" | "conflict",
      "severity": "low" | "medium" | "high",
      "issue_text": "The phrase 'Net Revenue' is used in Section 4 but never defined.",
      "location_hint": "Section 4 / Clause 12",
      "recommendation": "Add a definition for Net Revenue in Section 1."
    }
  ],
  "audit_summary": "Found 2 undefined terms and 1 broken cross-reference."
}

Do not include any conversational text. Return only valid JSON.
`;

/**
 * Runs a contract-wide cross-reference audit.
 * @param {string} contractId 
 */
async function runCrossRefAudit(contractId) {
    const contract = await Contract.findById(contractId).select('originalFileName');
    if (!contract) return;

    // Fetch all clauses in order to reconstruct the document
    const clauses = await Clause.find({ contractId }).sort({ segmentIndex: 1 }).select('segmentIndex rawText');
    if (clauses.length === 0) return;

    // Combine text with segment markers to help the LLM identify locations
    const fullTextWithMarkers = clauses
        .map(c => `[Clause ${c.segmentIndex + 1}]\n${c.rawText}`)
        .join('\n\n');

    try {
        console.log(`[Agent 9] Running Cross-Reference Audit for contract ${contractId}...`);
        
        const parsed = await callLLM({
            systemPrompt: AGENT9_SYSTEM_PROMPT,
            userContent: `Analyze this contract:\n\n${fullTextWithMarkers}`,
            jsonMode: true,
            temperature: 0.1
        });

        // Save findings to the Contract model
        await Contract.findByIdAndUpdate(contractId, {
            crossRefFindings: parsed.cross_ref_findings || [],
            crossRefAuditSummary: parsed.audit_summary || 'No issues found.'
        });

        console.log(`✅ [Agent 9] Audit complete. Found ${parsed.cross_ref_findings?.length || 0} issues.`);

    } catch (error) {
        console.error(`❌ [Agent 9] Audit failed: ${error.message}`);
    }
}

module.exports = { runCrossRefAudit };
