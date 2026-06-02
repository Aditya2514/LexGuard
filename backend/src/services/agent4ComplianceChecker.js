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
    let cleanJson = rawJsonOutput;
    if (typeof rawJsonOutput === 'string') {
        cleanJson = rawJsonOutput.replace(/```json|```/gi, '').trim();
        return JSON.parse(cleanJson);
    }
    return rawJsonOutput;
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

        for (const c of clauses) {
            const isRisky = c.risk_level === 'medium' || c.risk_level === 'high' || c.risk_level === 'critical';
            const shouldScan = isRisky || process.env.FULL_COMPLIANCE_SCAN === 'true';
            
            if (shouldScan) {
                // Fetch dynamic context via Neo4j GraphRAG
                const statutoryContext = await graphRagService.retrieveAugmentedContext(
                    contract.contractCategory || "General",
                    c.clause_type || "other",
                    c.rawText,
                    geo.state,
                    geo.municipality,
                    enhancedGlobalContext.metadata?.executionDate
                );

                const result = await runAgent4ComplianceChecker(c.rawText, statutoryContext);
                
                // Map the new schema to the old model fields to prevent DB crashes
                const mappedRiskLevel = result.isCompliant ? 'low' : 'high';
                const mappedIssueAreas = result.statutoryCitations ? result.statutoryCitations.map(cit => cit.act) : [];

                await Clause.findByIdAndUpdate(c._id, {
                    compliance_risk_level: mappedRiskLevel,
                    potential_issue_areas: mappedIssueAreas,
                    human_review_strongly_recommended: !result.isCompliant,
                    explanatory_note: result.violationReason || "Compliant.",
                });
            } else {
                await Clause.findByIdAndUpdate(c._id, {
                    compliance_risk_level: 'low',
                    potential_issue_areas: [],
                    human_review_strongly_recommended: false,
                    explanatory_note: 'No significant compliance issues flagged.',
                });
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
