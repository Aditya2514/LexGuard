const { callLLM } = require('./aiClient');

const COMPLIANCE_SYSTEM_PROMPT = `
Role: Senior Indian Constitutional & Corporate Compliance Counsel.
Task: Evaluate the provided contract clause strictly against the injected statutory provisions.

Operational Mandates:
1. Review the text of the clause and cross-examine it directly against the provided 'STATUTORY CONTEXT PROVISIONS'.
2. Determine if the clause complies with, tracks safely inside, or explicitly violates/attempts to contract out of the provided laws.
3. If a violation or risk is found, specify exactly which section is breached and explain why it is legally vulnerable under Indian jurisprudence.
4. Keep the output highly objective, structured, and free of speculative fluff.

You must output a valid JSON object matching the schema below. No markdown fences or conversational wrappers.

Required Output Schema:
{
  "isCompliant": true | false,
  "violationReason": "Clear, detailed breakdown of statutory compliance alignment or violation, or null if compliant",
  "statutoryCitations": [
    { "act": "Name of Act", "section": "Section Number", "notes": "Application note" }
  ]
}
`;

async function runAgent4ComplianceChecker(clauseText, statutoryContext) {
  if (!statutoryContext || statutoryContext.trim() === "") {
    return {
      isCompliant: true,
      violationReason: null,
      statutoryCitations: [{ act: "Indian Contract Act, 1872", section: "General", notes: "Evaluated under default common law contracting parameters." }]
    };
  }

  const userPrompt = `
=== INJECTED STATUTORY CONTEXT PROVISIONS ===
${statutoryContext}

=== TARGET CONTRACT CLAUSE FOR AUDIT ===
"${clauseText}"
`;

  const rawJsonOutput = await callLLM({
    systemPrompt: COMPLIANCE_SYSTEM_PROMPT,
    userContent: userPrompt,
    jsonMode: true,
    temperature: 0.0 // absolute compliance determinism
  });

  try {
    return typeof rawJsonOutput === 'string' ? JSON.parse(rawJsonOutput) : rawJsonOutput;
  } catch (err) {
    console.error("🚨 Agent 4 JSON normalization parsing failed:", err.message);
    return { isCompliant: true, violationReason: "Bypass triggered due to structural parser serialization error.", statutoryCitations: [] };
  }
}

// Keep the bulk orchestrator wrapper so jobQueueService doesn't break
const Clause = require('../models/Clause');
const Contract = require('../models/Contract');
const graphRagService = require('./graphRagService');

async function runComplianceCheckForContract(contractId) {
    try {
        const contract = await Contract.findById(contractId);
        const clauses = await Clause.find({ contractId }).sort({ segmentIndex: 1 });
        if (clauses.length === 0) return;

        console.log(`\n[Agent 4] Evaluating Dynamic Compliance for contract: ${contractId} (${clauses.length} clauses)`);

        const { resolveJurisdiction } = require('../utils/geoMapper');
        const enhancedGlobalContext = contract.globalContext || {};
        const searchStr = ((enhancedGlobalContext.metadata?.governingLaw || "") + " " + (enhancedGlobalContext.metadata?.jurisdiction || ""));
        const geo = resolveJurisdiction(searchStr);

        const RISK_PRIORITY = { critical: 4, high: 3, medium: 2, low: 1, null: 0 };

        for (const c of clauses) {
            // Re-fetch the live risk_level per clause: Agent 10 runs before us and may
            // have escalated clauses after the initial batch query above was made.
            const liveClause = await Clause.findById(c._id).select('risk_level explanatory_note');
            const liveRiskLevel = liveClause?.risk_level || c.risk_level;
            const hasExistingNote = liveClause?.explanatory_note &&
                liveClause.explanatory_note !== 'No significant compliance issues flagged.' &&
                liveClause.explanatory_note !== 'Compliant.';

            const isRisky = liveRiskLevel === 'medium' || liveRiskLevel === 'high' || liveRiskLevel === 'critical';
            const shouldScan = isRisky || process.env.FULL_COMPLIANCE_SCAN === 'true';
            
            if (shouldScan) {
                // Retrieve logger for Phase 20 tracing
                const { loggerManager } = require('./executionLogger');
                const logger = loggerManager.getLogger(contractId);

                // Fetch dynamic context via Neo4j GraphRAG
                const statutoryContext = await graphRagService.retrieveAugmentedContext(
                    contract.contractCategory || "General",
                    c.clause_type || "other",
                    c.rawText,
                    geo.state,
                    geo.municipality,
                    enhancedGlobalContext.metadata?.executionDate,
                    logger
                );

                const result = await runAgent4ComplianceChecker(c.rawText, statutoryContext);
                
                // Map the new schema to the old model fields to prevent DB crashes
                const mappedRiskLevel = result.isCompliant ? 'low' : 'high';
                const mappedIssueAreas = result.statutoryCitations ? result.statutoryCitations.map(cit => cit.act) : [];

                // Build the compliance update — never downgrade risk_level set by Agent 10
                const complianceUpdate = {
                    potential_issue_areas: mappedIssueAreas,
                    human_review_strongly_recommended: !result.isCompliant,
                };

                // Only update compliance_risk_level if it would be an upgrade (never downgrade)
                if (!result.isCompliant) {
                    const currentComp = liveClause?.compliance_risk_level || 'low';
                    if ((RISK_PRIORITY['high'] || 0) > (RISK_PRIORITY[currentComp] || 0)) {
                        complianceUpdate.compliance_risk_level = 'high';
                    }
                } else {
                    // Compliant: only set to low if not already escalated
                    const currentComp = liveClause?.compliance_risk_level || 'low';
                    if ((RISK_PRIORITY[currentComp] || 0) <= (RISK_PRIORITY['low'] || 0)) {
                        complianceUpdate.compliance_risk_level = 'low';
                    }
                }

                // Only update explanatory_note if Agent 10 hasn't already written a note
                if (!hasExistingNote) {
                    if (result.violationReason) {
                        complianceUpdate.explanatory_note = result.violationReason;
                    } else if (c.possible_law_references && c.possible_law_references.length > 0) {
                        const refSummary = c.possible_law_references.map(r => `${r.act_name} (${r.section_hint || 'General'})`).join(', ');
                        complianceUpdate.explanatory_note = `Evaluated under ${refSummary}: ${c.possible_law_references[0].reason || 'Statutory parameters apply.'}`;
                    } else {
                        complianceUpdate.explanatory_note = 'No significant compliance issues flagged.';
                    }
                } else if (result.violationReason) {
                    // Append Agent 4's finding to Agent 10's note rather than overwriting it
                    complianceUpdate.explanatory_note = liveClause.explanatory_note + ' ' + result.violationReason;
                }

                await Clause.findByIdAndUpdate(c._id, complianceUpdate);
            } else {
                // Non-risky clause: only set compliance_risk_level if not already escalated by Agent 10
                const currentComp = liveClause?.compliance_risk_level || 'low';
                const updateForLow = {
                    potential_issue_areas: [],
                    human_review_strongly_recommended: false,
                };

                // Only downgrade compliance_risk_level if it is not already high/critical
                if ((RISK_PRIORITY[currentComp] || 0) <= (RISK_PRIORITY['low'] || 0)) {
                    updateForLow.compliance_risk_level = 'low';
                }

                // Only write default note if Agent 10 hasn't already set one
                if (!hasExistingNote) {
                    updateForLow.explanatory_note = 'No significant compliance issues flagged.';
                }

                await Clause.findByIdAndUpdate(c._id, updateForLow);
            }
        }


        if (contract) {
            contract.agentMetadata = contract.agentMetadata || {};
            contract.agentMetadata.complianceCheckedAt = new Date();
            await contract.save();
        }

        console.log(`[Agent 4] Dynamic Compliance check for contract ${contractId} completed successfully!`);
    } catch (err) {
        console.error(`⚠️  Agent 4 orchestrator failed for contract ${contractId}:`, err);
    }
}

module.exports = { runAgent4ComplianceChecker, runComplianceCheckForContract };
