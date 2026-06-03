const { callLLM } = require('./aiClient');
const Contract = require('../models/Contract');
const Clause = require('../models/Clause');

const EXTRACTION_PROMPT = `
You are Agent 10 (The Deterministic Auditor) for LexGuard.
Your only job is to extract exact numerical, financial, and temporal parameters from the contract.
DO NOT perform any legal analysis. Do not look for risks.
If a parameter is not explicitly stated in the contract, set its value to null.
Extract all milestones as an array of numbers.
Ensure all outputs strictly adhere to the following JSON schema:
{
  "financials": {
    "total_contract_value": Number | null,
    "milestones": [Number] // array of milestone amounts
  },
  "timelines": {
    "acceptance_period_days": Number | null,
    "deemed_acceptance_days": Number | null
  },
  "retention": {
    "general_retention_years": Number | null,
    "tax_retention_years": Number | null
  },
  "notice_periods": {
    "security_breach_hours": Number | null
  }
}
`;

async function runAgent10DeterministicAudit(contractId) {
    console.log(`[Agent 10] Starting Deterministic Audit for contract: ${contractId}`);

    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    const clauses = await Clause.find({ contractId }).sort('segmentIndex');
    const fullText = clauses.map(c => c.rawText).join('\n\n');

    // Step 1: LLM Extraction Pass
    const llmResult = await callLLM({
        systemPrompt: EXTRACTION_PROMPT,
        userContent: JSON.stringify({ contractText: fullText }),
        jsonMode: true,
        temperature: 0.0, // Absolute zero for deterministic extraction
        maxTokens: 2000
    });

    const data = llmResult.parsed;
    let newRisksCount = 0;

    // Helper to push a deterministic risk to the database
    const pushRisk = async (severity, reason, title) => {
        // We will create a special 'Global' clause for document-wide deterministic risks, 
        // or append it to the contract itself. For now, let's create a synthesized Clause record.
        const newRisk = new Clause({
            contractId,
            segmentIndex: 9999 + newRisksCount, // Put at the end
            rawText: `[DETERMINISTIC VALIDATION FAILURE] ${title}`,
            analysis_status: 'completed',
            risk_level: severity,
            compliance_risk: severity,
            reasons: [reason],
            agent_source: 'Agent10'
        });
        await newRisk.save();
        newRisksCount++;
        console.log(`🚨 [Agent 10] Deterministic Risk Found: ${title}`);
    };

    // Step 2: Native JS Validation Pass
    
    // Rule 1: Financial Math Check
    if (data?.financials) {
        const total = data.financials.total_contract_value;
        const milestones = data.financials.milestones || [];
        if (typeof total === 'number' && milestones.length > 0) {
            const sum = milestones.reduce((a, b) => a + b, 0);
            if (sum !== total) {
                await pushRisk(
                    'critical', 
                    `Mathematical contradiction: Milestones sum to $${sum} but the stated total contract value is $${total}.`,
                    'Financial Milestone Discrepancy'
                );
            }
        }
    }

    // Rule 2: Acceptance Logic Check
    if (data?.timelines) {
        const review = data.timelines.acceptance_period_days;
        const deemed = data.timelines.deemed_acceptance_days;
        if (typeof review === 'number' && typeof deemed === 'number') {
            if (deemed < review) {
                await pushRisk(
                    'high',
                    `Timeline contradiction: Deemed acceptance triggers in ${deemed} days, but the client has ${review} days to review the deliverable.`,
                    'Deemed Acceptance Precedence Issue'
                );
            }
        }
    }

    // Rule 3: Retention Conflicts
    if (data?.retention) {
        const gen = data.retention.general_retention_years;
        const tax = data.retention.tax_retention_years;
        if (typeof gen === 'number' && typeof tax === 'number') {
            if (tax > gen) {
                await pushRisk(
                    'medium',
                    `Retention conflict: General record retention is ${gen} years, but tax record retention is ${tax} years, creating a data-handling contradiction.`,
                    'Conflicting Retention Periods'
                );
            }
        }
    }

    // Rule 4: Security Notice Constraints
    if (data?.notice_periods) {
        const sec = data.notice_periods.security_breach_hours;
        if (typeof sec === 'number' && sec < 48) {
            await pushRisk(
                'high',
                `Aggressive Security SLA: The contract mandates a security breach notification within ${sec} hours, which may be operationally impossible and violates typical 72-hour GDPR baselines.`,
                'Impossible Security Notice SLA'
            );
        }
    }

    console.log(`✅ [Agent 10] Deterministic Audit completed. Found ${newRisksCount} hardcoded errors.`);
}

module.exports = { runAgent10DeterministicAudit };
