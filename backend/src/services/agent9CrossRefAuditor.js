/**
 * Agent 9: Cross-Reference Auditor
 * 
 * Scans the entire contract text to find broken cross-references,
 * undefined capitalized terms, and circular dependencies. This solves
 * a major source of contract ambiguity and downstream legal risk.
 */

const { callLLM } = require('./aiClient');
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
        console.log(`[Agent 9] Running Cross-Reference Audit for contract ${contractId} (${clauses.length} clauses)...`);

        const CHUNK_SIZE = 15; // Process max 15 clauses per LLM window
        const allFindings = [];
        let combinedSummary = '';

        if (clauses.length <= CHUNK_SIZE) {
            // Small contract: single pass
            const parsed = await callLLM({
                systemPrompt: AGENT9_SYSTEM_PROMPT,
                userContent: `Analyze this contract:\n\n${fullTextWithMarkers}`,
                jsonMode: true,
                temperature: 0.1
            });
            allFindings.push(...(parsed.cross_ref_findings || []));
            combinedSummary = parsed.audit_summary || 'No issues found.';
        } else {
            // Large contract: chunked windowed analysis
            console.log(`[Agent 9] Large contract detected (${clauses.length} clauses). Using chunked analysis.`);
            const clauseMarkers = clauses.map(c => `[Clause ${c.segmentIndex + 1}]\n${c.rawText}`);

            for (let i = 0; i < clauseMarkers.length; i += CHUNK_SIZE) {
                const window = clauseMarkers.slice(i, i + CHUNK_SIZE);
                const windowText = window.join('\n\n');
                const windowLabel = `Clauses ${i + 1}–${Math.min(i + CHUNK_SIZE, clauses.length)}`;

                const parsed = await callLLM({
                    systemPrompt: AGENT9_SYSTEM_PROMPT,
                    userContent: `Analyze this contract segment (${windowLabel} of ${clauses.length} total):\n\n${windowText}`,
                    jsonMode: true,
                    temperature: 0.1
                });

                if (parsed?.cross_ref_findings?.length > 0) {
                    allFindings.push(...parsed.cross_ref_findings);
                }
                if (parsed?.audit_summary && parsed.audit_summary !== 'No issues found.') {
                    combinedSummary += (combinedSummary ? ' ' : '') + parsed.audit_summary;
                }
            }

            if (!combinedSummary) combinedSummary = 'No issues found across all contract segments.';

            // Deduplicate findings by issue_text similarity (exact match dedupe)
            const seen = new Set();
            const deduped = allFindings.filter(f => {
                const key = `${f.type}::${f.issue_text?.substring(0, 60)}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            allFindings.splice(0, allFindings.length, ...deduped);
        }

        // Save findings to the Contract model
        await Contract.findByIdAndUpdate(contractId, {
            crossRefFindings: allFindings,
            crossRefAuditSummary: combinedSummary
        });

        console.log(`✅ [Agent 9] Audit complete. Found ${allFindings.length} issues.`);

    } catch (error) {
        console.error(`❌ [Agent 9] Audit failed: ${error.message}`);
    }
}

module.exports = { runCrossRefAudit };
