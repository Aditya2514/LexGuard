const { callLLM } = require('./aiClient');
const Contract = require('../models/Contract');
const Clause = require('../models/Clause');

const DYNAMIC_EXTRACTION_PROMPT = `
You are Agent 10 (The Deterministic Evaluator) for LexGuard.
Your objective is to map out the financial, chronological, and structural dependencies of this contract and output them as a strict JSON DSL (Domain Specific Language).

You must extract two things:
1. FACTS: The exact numerical, temporal, or logical parameters explicitly written in the contract.
2. RULES: The logical constraints that must be true for the contract to be mathematically and procedurally sound.

Output Schema MUST be valid JSON matching this exact structure:
{
  "facts": {
    "fact_key_name": {
      "value": "actual value (can be number, string, or boolean)",
      "clause": "Clause 4.1",
      "text": "Exact quote from the text proving this fact.",
      "confidence": 0.95
    }
  },
  "rules": [
    {
      "id": "snake_case_rule_id",
      "type": "operator_name",
      "left": "fact_key_name",
      "right": "fact_key_name",
      "severity": "critical",
      "title": "Short title of the risk if rule fails",
      "reason": "Detailed explanation of why this contradicts or fails"
    }
  ]
}

Supported Rule Types (Operators):
- "sum_equals": The sum of 'left' facts must equal the sum of 'right' facts.
- "equals": 'left' must strictly equal 'right'.
- "greater_than": 'left' must be greater than 'right'.
- "less_than": 'left' must be less than 'right'.
- "date_before": 'left' date must occur before 'right' date.
- "date_after": 'left' date must occur after 'right' date.
- "all_equal": All facts listed in 'left' array must have the exact same value.
- "exists": The fact in 'left' must exist in the document.
- "not_exists": The fact in 'left' must NOT exist in the document.

CRITICAL INSTRUCTIONS:
- You do NOT execute the rules. You ONLY define them.
- If a rule evaluates to FALSE, our deterministic engine will flag it as a risk. Therefore, write rules representing the REQUIRED COMPLIANT STATE.
- Only extract facts you are highly confident about. Set confidence strictly.
- Ensure 'left' and 'right' keys exactly match the keys you define in the 'facts' dictionary.
`;

function evaluateRule(rule, facts) {
    const getValues = (keyOrKeys) => {
        if (!keyOrKeys) return [];
        if (Array.isArray(keyOrKeys)) return keyOrKeys.map(k => facts[k]).filter(f => f && f.confidence > 0.5);
        const f = facts[keyOrKeys];
        return (f && f.confidence > 0.5) ? [f] : [];
    };

    const leftFacts = getValues(rule.left);
    const rightFacts = getValues(rule.right);
    const allFacts = [...leftFacts, ...rightFacts];

    // If facts required for evaluation are missing, we cannot evaluate deterministically
    if (rule.type !== 'exists' && rule.type !== 'not_exists') {
        if (leftFacts.length === 0) return null; 
    }

    let passed = true;
    const leftVals = leftFacts.map(f => f.value);
    const rightVals = rightFacts.map(f => f.value);

    switch(rule.type) {
        case 'sum_equals':
            const sumL = leftVals.reduce((a,b)=>a+b, 0);
            const sumR = rightVals.reduce((a,b)=>a+b, 0);
            passed = (sumL === sumR);
            break;
        case 'greater_than':
            passed = leftVals[0] > rightVals[0];
            break;
        case 'less_than':
            passed = leftVals[0] < rightVals[0];
            break;
        case 'equals':
            passed = leftVals[0] === rightVals[0];
            break;
        case 'all_equal':
            passed = leftVals.every(v => v === leftVals[0]);
            break;
        case 'date_before':
            passed = new Date(leftVals[0]) < new Date(rightVals[0]);
            break;
        case 'date_after':
            passed = new Date(leftVals[0]) > new Date(rightVals[0]);
            break;
        case 'exists':
            passed = leftFacts.length > 0;
            break;
        case 'not_exists':
            passed = leftFacts.length === 0;
            break;
        default:
            passed = true;
    }

    if (!passed) {
        const evidenceLines = [];
        allFacts.forEach(f => {
            if (f.clause && f.text) {
                evidenceLines.push(`${f.clause}: "${f.text}"`);
            }
        });

        // Deduplicate evidence lines
        const uniqueEvidence = [...new Set(evidenceLines)];
        
        return {
            id: rule.id || 'rule_violation',
            severity: rule.severity || 'high',
            title: rule.title,
            reason: rule.reason,
            evidence: uniqueEvidence
        };
    }
    return null;
}

async function runAgent10DeterministicAudit(contractId) {
    console.log(`[Agent 10] Starting Deterministic Rule Engine for contract: ${contractId}`);

    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    const clauses = await Clause.find({ contractId }).sort('segmentIndex');
    const fullText = clauses.map(c => c.rawText).join('\n\n');

    // Step 1: LLM Fact & Dependency Extraction
    const llmResult = await callLLM({
        systemPrompt: DYNAMIC_EXTRACTION_PROMPT,
        userContent: JSON.stringify({ contractText: fullText }),
        jsonMode: true,
        temperature: 0.1, 
        maxTokens: 4000
    });

    const data = llmResult.parsed || {};
    const facts = data.facts || {};
    const rules = data.rules || [];
    
    let newRisksCount = 0;

    const pushRisk = async (finding) => {
        const fullReason = finding.evidence && finding.evidence.length > 0 
            ? `${finding.reason}\n\nEvidence:\n- ${finding.evidence.join('\n- ')}` 
            : finding.reason;

        const newRisk = new Clause({
            contractId,
            segmentIndex: 9999 + newRisksCount,
            rawText: `[DETERMINISTIC VALIDATION FAILURE] ${finding.title}`,
            analysis_status: 'completed',
            risk_level: finding.severity,
            compliance_risk: finding.severity,
            reasons: [fullReason],
            agent_source: 'Agent10'
        });
        await newRisk.save();
        newRisksCount++;
        console.log(`🚨 [Agent 10] DSL Rule Failed [${finding.id}]: ${finding.title}`);
    };

    // Step 2: Deterministic Rule Evaluation Engine
    if (Object.keys(facts).length > 0 && rules.length > 0) {
        console.log(`[Agent 10] Evaluating ${rules.length} constraints against ${Object.keys(facts).length} extracted facts...`);
        for (const rule of rules) {
            try {
                const failure = evaluateRule(rule, facts);
                if (failure) {
                    await pushRisk(failure);
                }
            } catch (err) {
                console.error(`⚠️ [Agent 10] Engine failed to evaluate rule ${rule.id}:`, err.message);
            }
        }
    } else {
        console.warn(`[Agent 10] LLM did not extract sufficient facts or rules for evaluation.`);
    }

    console.log(`✅ [Agent 10] Deterministic Engine completed. Found ${newRisksCount} contradictions.`);
}

module.exports = { runAgent10DeterministicAudit };
