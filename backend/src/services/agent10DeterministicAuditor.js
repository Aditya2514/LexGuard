/**
 * Agent 10: Deterministic Auditor (Rebuilt — Phase 26)
 * 
 * Three-layer architecture:
 *   Layer 1: Deterministic Fact Extraction + Canonicalization (zero LLM)
 *   Layer 2: Deterministic Contradiction Rules (zero LLM)
 *   Layer 3: Semantic Contradiction Detection (zero LLM pattern matching)
 *   Bonus:   Optional LLM enhancement pass (if provider available)
 * 
 * This agent produces results even when ALL LLM providers are rate-limited.
 */

const { callLLM } = require('./aiClient');
const Contract = require('../models/Contract');
const Clause = require('../models/Clause');
const { extractFactTable } = require('./deterministicFactExtractor');
const { detectContradictions } = require('./crossClauseContradictionEngine');

// ── Optional LLM DSL Prompt (Phase 4 — supplementary, not primary) ────────
const DSL_EXTRACTION_PROMPT = `
You are Agent 10 (The Deterministic Code Interpreter) for LexGuard.
Your objective is to catch hard mathematical, financial, and chronological contradictions in the provided contract.
Extract rules in a strict JSON Domain Specific Language (DSL).

Output Schema:
{
  "rules": [
    {
      "type": "sum_equals" | "multiply_equals" | "less_than_or_equal" | "greater_than" | "timeline_conflict",
      "leftFact": { "label": "description", "value": <Array of Numbers or single Number> },
      "rightFact": { "label": "description", "value": <Number> },
      "title": "Short title of the rule being checked",
      "severity": "critical" | "high" | "medium",
      "reason": "Explanation of the contradiction if this rule is violated."
    }
  ]
}

Return ONLY valid JSON. NO EXPRESSIONS — only literal Numbers or Arrays of Numbers.
`;

/**
 * Main entry point for Agent 10.
 * @param {string} contractId 
 */
async function runAgent10DeterministicAudit(contractId) {
    console.log(`[Agent 10] Starting Three-Layer Deterministic Auditor for contract: ${contractId}`);

    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    // Delete any existing virtual clauses from previous runs of Agent 10
    await Clause.deleteMany({ contractId, segmentIndex: { $gte: 9999 } });

    const clauses = await Clause.find({ contractId }).sort('segmentIndex');
    if (clauses.length === 0) {
        console.warn('[Agent 10] No clauses found. Skipping.');
        return;
    }

    let newRisksCount = 0;

    const pushRisk = async (severity, reason, title, clauseRefs = []) => {
        let updatedCount = 0;
        if (clauseRefs && clauseRefs.length > 0) {
            const targetClauses = await Clause.find({
                contractId,
                segmentIndex: { $in: clauseRefs }
            });
            if (targetClauses.length > 0) {
                const RISK_PRIORITY = { critical: 4, high: 3, medium: 2, low: 1, null: 0 };
                const COMP_PRIORITY = { high: 3, medium: 2, low: 1, null: 0 };

                for (const targetClause of targetClauses) {
                    const currentLevel = targetClause.risk_level || 'low';
                    if (RISK_PRIORITY[severity] > RISK_PRIORITY[currentLevel]) {
                        targetClause.risk_level = severity;
                    }
                    
                    const newRiskScore = severity === 'critical' ? 10 : severity === 'high' ? 8 : 6;
                    targetClause.risk_score = Math.max(targetClause.risk_score || 0, newRiskScore);
                    
                    if (!targetClause.risk_reasons) targetClause.risk_reasons = [];
                    if (!targetClause.risk_reasons.includes(reason)) {
                        targetClause.risk_reasons.push(reason);
                    }

                    if (!targetClause.reasons) targetClause.reasons = [];
                    if (!targetClause.reasons.includes(reason)) {
                        targetClause.reasons.push(reason);
                    }

                    targetClause.confidence_score = 10;

                    const compSeverity = (severity === 'critical' || severity === 'high') ? 'high' : (severity === 'medium' ? 'medium' : 'low');
                    const curComp = targetClause.compliance_risk_level || 'low';
                    if (COMP_PRIORITY[compSeverity] > COMP_PRIORITY[curComp]) {
                        targetClause.compliance_risk_level = compSeverity;
                    }

                    await targetClause.save();
                    updatedCount++;
                }
            }
        }

        if (updatedCount === 0 && clauses.length > 0) {
            const titleLower = (title || '').toLowerCase();
            const reasonLower = (reason || '').toLowerCase();
            
            // Intelligently map to target clause if text/type matches finding
            const targetClause = clauses.find(c => {
                const textLower = (c.rawText || '').toLowerCase();
                const typeLower = (c.clauseType || '').toLowerCase();
                if ((titleLower.includes('restricted') || reasonLower.includes('restricted')) && (typeLower.includes('non_compete') || textLower.includes('restricted period'))) return true;
                if ((titleLower.includes('product') || reasonLower.includes('work product')) && (typeLower.includes('ip') || textLower.includes('work product'))) return true;
                return false;
            });

            if (targetClause) {
                targetClause.risk_reasons = targetClause.risk_reasons || [];
                if (!targetClause.risk_reasons.includes(`[Deterministic Finding] ${title}: ${reason}`)) {
                    targetClause.risk_reasons.push(`[Deterministic Finding] ${title}: ${reason}`);
                }
                targetClause.risk_level = severity;
                targetClause.risk_score = Math.max(targetClause.risk_score || 0, severity === 'critical' ? 10 : 8);
                await targetClause.save();
            }

            // Store in contract-level contradictions array without corrupting Clause #1 opening header
            await Contract.findByIdAndUpdate(contractId, {
                $push: {
                    contradictions: {
                        title: title,
                        severity: severity,
                        reason: reason,
                        timestamp: new Date()
                    }
                }
            });
            console.log(`🚨 [Agent 10] Deterministic Trap Caught (Document-Level Finding): ${title} (${severity})`);
        } else {
            console.log(`🚨 [Agent 10] Deterministic Trap Caught: ${title} (${severity}) - Mapped to ${updatedCount} original clauses.`);
        }
    };

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 1: Zero-LLM Deterministic Extraction + Contradiction Detection
    // ════════════════════════════════════════════════════════════════════════
    console.log(`[Agent 10] Phase 1: Extracting facts from ${clauses.length} clauses...`);

    const clauseData = clauses.map(c => ({
        segmentIndex: c.segmentIndex,
        rawText: c.rawText,
    }));

    const factTable = extractFactTable(clauseData);
    console.log(`[Agent 10] Phase 1: Extracted ${factTable.facts.length} facts (${Object.keys(factTable.categorizedFacts).length} categories).`);

    const { findings } = detectContradictions(factTable, clauseData);
    console.log(`[Agent 10] Phase 1: Contradiction engine found ${findings.length} issues.`);

    // Persist all deterministic findings
    for (const finding of findings) {
        await pushRisk(finding.severity, finding.reason, finding.title, finding.clauseRefs);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 2: Optional LLM Enhancement Pass
    // ════════════════════════════════════════════════════════════════════════
    // Only runs if an LLM provider is available. This catches qualitative
    // contradictions that pure regex/pattern-matching may miss.
    try {
        console.log(`[Agent 10] Phase 2: Attempting LLM enhancement pass...`);
        const fullText = clauses.map(c => c.rawText).join('\n\n');

        const llmResult = await callLLM({
            systemPrompt: DSL_EXTRACTION_PROMPT,
            userContent: JSON.stringify({ contractText: fullText }),
            jsonMode: true,
            temperature: 0.1,
            maxTokens: 4000
        });

        // callLLM already returns the parsed object directly — no need for .parsed
        const data = llmResult;

        if (data?.rules && Array.isArray(data.rules)) {
            console.log(`[Agent 10] Phase 2: LLM returned ${data.rules.length} DSL rules.`);

            // Schema guard: Normalize hallucinated types
            const parseCleanNumber = (val) => {
                if (typeof val === 'number') return val;
                const strVal = String(val).toLowerCase();
                const cleaned = strVal.replace(/[^0-9.-]+/g, '');
                let num = Number(cleaned);
                if (strVal.includes('k') && num < 1000) num *= 1000;
                if (strVal.includes('m') && num < 1000) num *= 1000000;
                return isNaN(num) ? 0 : num;
            };

            for (const rule of data.rules) {
                try {
                    let rawType = String(rule.type || '').toLowerCase().trim();
                    let type = rawType;
                    if (rawType.includes('sum') || rawType.includes('math') || rawType.includes('add')) type = 'sum_equals';
                    else if (rawType.includes('multiply') || rawType.includes('multiplier')) type = 'multiply_equals';
                    else if (rawType.includes('timeline') || rawType.includes('less') || rawType.includes('conflict')) type = 'less_than_or_equal';
                    else if (rawType.includes('greater')) type = 'greater_than';

                    let leftVal = rule.leftFact?.value;
                    let rightVal = rule.rightFact?.value;
                    let passed = true;

                    if (type === 'sum_equals') {
                        let arr = Array.isArray(leftVal) ? leftVal : String(leftVal).split(',');
                        const sum = arr.reduce((a, b) => a + parseCleanNumber(b), 0);
                        passed = Math.abs(sum - parseCleanNumber(rightVal)) < 0.01;
                    }
                    else if (type === 'multiply_equals') {
                        let arr = Array.isArray(leftVal) ? leftVal : String(leftVal).split(',');
                        const product = arr.reduce((a, b) => a * (parseCleanNumber(b) || 1), 1);
                        passed = Math.abs(product - parseCleanNumber(rightVal)) < 0.01;
                    }
                    else if (type === 'less_than_or_equal') {
                        passed = (parseCleanNumber(leftVal) <= parseCleanNumber(rightVal));
                    }
                    else if (type === 'greater_than') {
                        passed = (parseCleanNumber(leftVal) > parseCleanNumber(rightVal));
                    }

                    if (!passed) {
                        // Check if this finding duplicates a Phase 1 finding
                        const titleLower = (rule.title || '').toLowerCase();
                        const isDuplicate = findings.some(f =>
                            f.title.toLowerCase().includes(titleLower.substring(0, 20)) ||
                            titleLower.includes(f.title.toLowerCase().substring(0, 20))
                        );

                        if (!isDuplicate) {
                            await pushRisk(
                                rule.severity || 'high',
                                rule.reason || `Contradiction detected between ${rule.leftFact?.label} and ${rule.rightFact?.label}.`,
                                rule.title || 'Mathematical/Temporal Contradiction'
                            );
                        } else {
                            console.log(`[Agent 10] Phase 2: Skipping duplicate LLM finding: ${rule.title}`);
                        }
                    }
                } catch (err) {
                    console.error(`⚠️ [Agent 10] Error evaluating DSL rule "${rule.title}": ${err.message}`);
                }
            }
        } else {
            console.warn(`[Agent 10] Phase 2: LLM did not return a valid "rules" array. Response keys: ${Object.keys(data || {}).join(', ') || '(empty)'}`);
        }
    } catch (llmErr) {
        // LLM enhancement is optional — if it fails, Phase 1 results still stand
        console.warn(`[Agent 10] Phase 2: LLM pass skipped (${llmErr.message}). Phase 1 deterministic results are preserved.`);
    }

    console.log(`✅ [Agent 10] Three-Layer Audit completed. Found ${newRisksCount} total contradictions.`);
}

module.exports = { runAgent10DeterministicAudit };
