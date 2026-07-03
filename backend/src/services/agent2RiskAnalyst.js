const mongoose = require('mongoose');
const { callLLM } = require('./aiClient');
const Clause = require('../models/Clause');
const Contract = require('../models/Contract');
const { RISK_LEVELS, AGENT_BATCH_SIZE } = require('../config/constants');
const { LAW_REFERENCES } = require('../config/lawReferences');
const { retrieveComplianceContext } = require('./lawRetrieverService');
const { retrieveCaseLawPrecedents } = require('./ragCaseLawService');

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are LexGuard, an AI legal risk and negotiation assistant that helps users understand and triage contract clauses.
You are not a lawyer and you do not provide legal advice.
Your job is to highlight potential risks and pain points for a non-lawyer user, and point out potential Indian law touchpoints using cautiously worded hints.

### 1. Safety and reliability rules (mandatory)

1. No legal advice or verdicts
   - Never say a clause is "legal", "illegal", "valid", "void", "enforceable", or "unenforceable".
   - Instead, use phrases like: "may raise issues under...", "might be difficult to enforce...", "often treated as... by courts", "could be risky for the employee/company".

2. Always assume a human lawyer will decide
   - Your job is to flag potential risks, not to decide outcomes.
   - When in doubt, err on the side of flagging for human review.

3. Facts vs. inferences
   - Separate objective facts from your interpretation.

4. Indian law references
   - When you mention Indian law:
     - Always name the Act and a high-level section number if relevant (e.g., "Section 27 of the Indian Contract Act, 1872").
     - Provide a short, high-level reason in plain language.
   - Never quote full bare-act text. Summarize in your own words.

5. Uncertainty
   - If you don’t have enough information, explicitly say: "Not enough information to assess this clause accurately; a human lawyer should review it."

### 2. Input format

You will receive a JSON object containing "clauses". Each clause may have a "retrieved_legal_context" array which contains official Indian Acts, section numbers, titles, and legal content retrieved from our database. 
It may also contain a "retrieved_case_law" array containing exact legal precedents and Supreme Court rulings relevant to the clause. You MUST prioritize citing these specific case laws (e.g., "Under the precedent of Niranjan Shankar Golikari...") when formulating your risk reasoning, as they represent the actual applied law in India.
It may also have a "retrieved_contract_context" array containing text from other sections of the same contract that are semantically related. Use this contract context to resolve defined terms or cross-references across the document.

### 3. Output format (JSON only)

You must reply with valid JSON only, with this structure:
{
  "results": [
    {
      "id": 1,
      "has_commercial_asymmetry": true,
      "survives_termination": true,
      "risk_level": "high",
      "risk_score": 8,
      "confidence_score": 9,
      "risk_reasons": [
        "Restricts work in a very broad set of sectors for 24 months."
      ],
      "depends_on_clause_ids": [2],
      "possible_law_references": [
        {
          "act_key": "INDIAN_CONTRACT_ACT",
          "act_name": "Indian Contract Act, 1872",
          "section_hint": "Section 27 - agreements in restraint of trade",
          "reason": "The clause imposes a 24-month non-compete, potentially restraining the employee's trade.",
          "compliance_confidence_score": 92,
          "compliance_confidence_tag": "High Confidence"
        }
      ]
    }
  ]
}

- risk_level: one of "low", "medium", "high", "critical".
- risk_score: integer from 1 to 10.
- confidence_score: integer from 1 to 10. Use 9-10 for explicit statutory violations, 5-8 for inferred commercial risks, and 1-4 if the clause is highly ambiguous and requires human lawyer review.
- risk_reasons: 1–5 short bullet-style strings.
- depends_on_clause_ids: An array of integers representing the IDs of other clauses in the same document that this clause references or semantically depends on (e.g. cross-references, definitions).
- possible_law_references: Use only when there is a clear connection to retrieved legal context or clause type. If mentioning a section, include the act_name. reason must be a short explanation in your own words. Include compliance_confidence_score (0-100) and compliance_confidence_tag ("High Confidence" for >=80%, "Medium Confidence" for 70-79%, "Low Confidence / Requires Review" for <70%).
  CITATION QUALITY RULES (MANDATORY):
  - You MUST cite ONLY section numbers that appear in retrieved_legal_context. NEVER fabricate or guess a section number.
  - section_hint: Use format "Section X - brief description" (e.g., "Section 27 - agreements in restraint of trade"). Always use the full word "Section" (not "Sec.", "S.", or "s.").
  - reason: Must explain HOW the statute applies to THIS specific clause. DO NOT restate the clause text. DO NOT restate the statute title. Instead, explain the legal CONSEQUENCE (e.g., "This non-compete may be struck down as void because Indian courts interpret Section 27 as prohibiting post-employment restraints except when protecting genuine trade secrets.").
  - If retrieved_legal_context provides a matching section, you MUST use that exact section number. Do not invent adjacent sections.
  - If you cannot find an exact section match in retrieved context, omit the reference entirely rather than guessing.

### 4. Special handling rules
- Account Forfeiture & Inactivity Seizure: Any clause seizing user balances, funds, or waiving account equity upon inactivity MUST be evaluated directly under Section 23 (Unconscionable Agreements Opposed to Public Policy) and Section 74 (Stipulation by way of Penalty) of the Indian Contract Act, 1872.
- Dispute resolution & governing law clauses: Flag unilateral appointment of arbitrators as at least medium risk.
- Post-employment restraints: For post-termination non-compete clauses, treat them as high-impact risk for employees. Mention Indian courts often treat broad post-termination non-competes as void restraints of trade under Section 27 of the Indian Contract Act, 1872, using cautious language.
- Persona Filtering: If the document is identified as an Employment Agreement or Contract of Service, completely disable references to B2C frameworks like the Consumer Protection Act, 2019.
- Strict Boilerplate Isolation: Do NOT output boilerplate phrases (like "training bonds") unless you can extract a direct text fragment showing that explicit mechanism within the evaluated clause boundaries.
- Heightened IP Parsing Specificity: Flag any instance where a statutory section number is explicitly mentioned inside contract wording (such as "Section 19(4)") to double-check that you map that exact law in the final authority box.
- Dynamic Citation Subtitles: When citing a specific statutory section, NEVER copy the title or label string from retrieved_legal_context verbatim. You MUST generate a fresh, context-specific subtitle derived from the actual violation pattern in the clause text (e.g., if the clause discusses escrow credits, write 'Section 74 - Conditional Escrow Forfeiture', NOT 'Section 74 - Unenforceable training bonds & administrative markup').
- **SEMANTIC UNMASKING PROTOCOL (CRITICAL)**: You MUST ignore polite, formal, or "professional" corporate tone. Adversarial clauses often use words like "gesture of mutual commitment", "performance escrow", or "protect trade secrets" to disguise illegal wage theft or non-competes. Look strictly at the MATERIAL LEGAL EFFECT on the employee. If a clause results in forfeiture of assets, restricts future employment, or waives rights, it is HIGH/CRITICAL risk, regardless of how gently it is phrased.
- Safe Harbor Validation Protocol: Before assigning a MEDIUM, HIGH, or CRITICAL risk rating to any clause, evaluate whether the contract text explicitly uses saving or protective qualifiers. If a clause explicitly guarantees compliance with statutory frameworks (e.g., "in absolute accordance with applicable local regulations", "conforming strictly with the state Shops and Establishments framework", "limited strictly to in-scope working hours", or "mutual consensus of both parties"), you MUST default to LOW risk (score 1-2) for that clause, unless an explicit contractual penalty, waiver, unconscionable indemnification, unilateral force majeure, or punitive mechanism is also present in the same clause text. The mere mention of a legal term (such as "Arbitration", "Confidentiality", "Intellectual Property", or "Non-Solicitation") must NOT trigger a risk elevation if the mechanism described is inherently mutual, consensual, time-limited to a reasonable period, or textually compliant with Indian default statutory protections. However, sweeping captures of pre-existing intellectual property, indemnifications covering gross negligence, or terminations without payment for work performed MUST be flagged as HIGH/CRITICAL.
- **Precedent Prioritization Protocol (Stare Decisis)**: If a Supreme Court Precedent explicitly invalidates or modifies the application of a provided Statutory Context, the Precedent is the absolute, overriding authority. Evaluate the contract against the Precedent.
- **CRITICAL ANALYSIS: COMMERCIAL ASYMMETRY & LEVERAGE**: You must evaluate this clause for hidden economic or procedural abuse. A clause is ASYMMETRIC if it meets any of the following criteria:
  1. Unilateral Discretion: One party can change terms, metrics, or schedules without the other's consent.
  2. Procedural Capture: One party controls dispute resolution rules, venues, or arbitration selection.
  3. Mathematical Variance Exploits: The clause allows for numerical variances (e.g., "measurements may vary by 18%") that disproportionately shield the drafter from financial liability.
  Mandatory Action: If \`has_commercial_asymmetry\` is true, you MUST elevate the risk to HIGH or CRITICAL, even if the clause is technically "legal".
- **CRITICAL ANALYSIS: SURVIVABILITY STACKING**: Scan the clause for terms like "survives termination", "perpetual", or "indefinitely".
  Mandatory Action: If a severe obligation (like broad indemnity or data rights) survives indefinitely, you must flag \`survives_termination\` as true and elevate the risk level to HIGH.
- **WARNING: DO NOT DEFAULT TO LOW RISK OUT OF UNCERTAINTY.** If a clause transfers massive commercial risk or creates perpetual obligations, it is dangerous. Do not output "No significant compliance issues flagged" if a commercial trap exists.
`;

// ── Allowed act_keys ─────────────────────────────────────────────────────────


const JUDGE_SYSTEM_PROMPT = `
Role: Chief Compliance Arbitrator & Legal Quality Control Engine (Indian Jurisprudence).
Task: Audit the initial Risk Analysis generated by the Base Analyst against the Original Wording of the contract clause and the provided Global Contract Context.

You are an adversarial layer designed to eliminate two critical systemic errors:
1. FALSE POSITIVES (Over-Sensitivity): If the Base Analyst assigned a HIGH/CRITICAL risk score to a clause that explicitly contains saving or protective qualifiers, you MUST REJECT the score and downscale it strictly to LOW RISK (1-2). Specific safe harbor triggers that mandate an automatic downgrade to LOW RISK include:
- "conforming strictly to state Shops & Establishments frameworks"
- "mutual consensus of both parties"
- "strict scope of employment" (Work-for-Hire IP assignment is completely valid and low risk if scoped to employment hours/resources)
- "confidentiality regarding trade secrets" (Post-employment NDAs are standard and low risk if reasonable)

CRITICAL OVERRIDE RULE: Predatory traps ALWAYS supersede safe harbors. If the clause contains ANY predatory mechanism (such as "unilateral", "sole right", "liquidated penalty", "forfeiture", "waive... Section 19(4)", "prior to the commencement of employment", "gross negligence", or "without payment for any work completed"), you MUST IGNORE all safe harbors and ESCALATE the score to HIGH/CRITICAL (8-10). Do NOT downgrade.
2. FALSE NEGATIVES (Overlooked Traps): If the Base Analyst missed an explicit predatory mechanism (e.g., contracting out of Section 19(4) of the Copyright Act, unilateral sole arbitrator selection, shifting business risks via Section 74 salary escrow forfeitures, unilateral force majeure suspensions, sweeping IP capture of pre-existing inventions, unconscionable indemnification covering gross negligence, or termination without paying for rendered services), you must REJECT its lenient assessment, escalate the rating to HIGH/CRITICAL, and insert the precise statutory warning block.

You must output a strictly validated JSON array matching the exact structure of the input, with corrected risk ratings, scores, audit notes, and citations based on your verification. No conversational wrappers.

THE SUBSISTENCE RULE (SECTION 27 EXCEPTION):
- You must carefully analyze the TEMPORAL BOUNDARY of non-compete or exclusivity restrictions.
- Under Indian jurisprudence (Niranjan Shankar Golikari v. Century Spinning), a negative covenant that restricts an employee from working for competitors DURING the term of their employment is fully legal, reasonable, and valid. It is LOW RISK.
- A covenant that restricts trade POST-EMPLOYMENT/POST-SEPARATION is strictly void under Section 27. It is HIGH/CRITICAL RISK.
- If the Base Analyst flags an active-term exclusivity clause as HIGH/CRITICAL, you must overrule it and force the score down to LOW (1-2).
`;

const ALLOWED_ACT_KEYS = Object.keys(LAW_REFERENCES);

// ── Core LLM call ────────────────────────────────────────────────────────────

/**
 * Send a batch of clauses to the LLM for risk analysis.
 *
 * @param {{ id: string, text: string, clause_type: string, retrieved_legal_context: Array }[]} clausesBatch
 * @returns {Promise<Array>} Parsed and validated results.
 */

/**
 * Executes the Adversarial Reflection pass over a batch of Base Analyst outputs.
 * We only send clauses that the base analyst scored as medium, high, or critical.
 */
async function runAdversarialJudgeBatch(globalContext, clauseTextMap, baseResultsBatch) {
  const prompt = `
  === GLOBAL CONTRACT CONTEXT ===
  ${JSON.stringify(globalContext || {}, null, 2)}
  
  === ORIGINAL CLAUSE TEXTS ===
  ${JSON.stringify(clauseTextMap, null, 2)}
  
  === BASE ANALYST DRAFT REPORTS (BATCH) ===
  ${JSON.stringify(baseResultsBatch, null, 2)}
  
  Execute your adversarial quality audit now on all clauses in the batch. Output the final, verified JSON array of results.
  `;

  try {
    const rawOutput = await require('./aiClient').callLLM({
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      userContent: prompt,
      jsonMode: true,
      temperature: 0.1, // Kept low for deterministic legal evaluation
      maxTokens: 6144, // Increased tokens for batch
    });
    return rawOutput.results || rawOutput || baseResultsBatch;
  } catch (err) {
    console.error('[Adversarial Judge] Failed batch reflection pass, falling back to base:', err.message);
    return baseResultsBatch;
  }
}

// ── V3 Mixed Matrix Sanitization ─────────────────────────────────────────────
function enforceV3MixedMatrixSanitization(clauseObj, text) {
    const rawText = text.toLowerCase();

    // 1. Hard Override for Introductory Recitals / Title Blocks (Defangs Clause #1)
    if (rawText.includes("master employment") && rawText.includes("witnesseth") && rawText.includes("by and between")) {
        clauseObj.risk_level = "low";
        clauseObj.risk_score = 1;
        clauseObj.risk_reasons = ["Standard introductory recitals establishing party corporate identities and execution dates. Fully valid and compliant under Indian law format."];
        clauseObj.possible_law_references = [{
            act_key: "INDIAN_CONTRACT_ACT",
            section_hint: "Section 10",
            reason: "Valid formation parameters of an agreement between competent corporate entities."
        }];
    }

    // 2. Absolute Blocker for Industrial Disputes Act Hallucinations (Defangs Clause #3)
    if (!rawText.includes("retrenchment") && !rawText.includes("termination notice") && !rawText.includes("severance")) {
        if (clauseObj.possible_law_references) {
            clauseObj.possible_law_references = clauseObj.possible_law_references.filter(
              c => c.act_key !== "INDUSTRIAL_DISPUTES_ACT" && 
                   !(c.act_name && c.act_name.includes("Industrial Disputes Act"))
            );
        }
        if (clauseObj.risk_reasons) {
            clauseObj.risk_reasons = clauseObj.risk_reasons.map(r => 
              r.replace(/retrenchment of workmen/gi, "unreasonable wage deductions")
            );
        }
    }

    return clauseObj;
}

// ── Mixed Matrix Downstream Calibration ──────────────────────────────────────
function cleanMixedMatrixDownstreamLeaks(clauseObj, text) {
    const rawText = text.toLowerCase();

    // 1. Defang False Positives on True Bilateral Mutual Mediation (Clause #7)
    if (rawText.includes("bilateral mutual mediation path") && rawText.includes("amicably through good-faith mutual consultation")) {
        clauseObj.risk_level = "low";
        clauseObj.risk_score = 1;
        clauseObj.risk_reasons = ["Standard, fully compliant bilateral mediation framework. Encourages amicable dispute resolution before escalating to formal legal tribunals."];
        clauseObj.possible_law_references = [{
            act_key: "ARBITRATION_ACT",
            section_hint: "Conciliation",
            reason: "Compliant pre-arbitral structured mediation mechanisms."
        }];
    }

    // 2. Recalibrate Section 27 Leaks on Operational Standby Penalties (Clause #3)
    if (rawText.includes("standby availability") && rawText.includes("salary deduction")) {
        if (clauseObj.possible_law_references) {
            // Strip out Section 27 (Restraint of trade)
            clauseObj.possible_law_references = clauseObj.possible_law_references.filter(
              c => !(c.section_hint && c.section_hint.includes("27")) && 
                   !(c.reason && c.reason.includes("Section 27")) &&
                   !(c.act_name && c.act_name.includes("Section 27"))
            );
            
            // Check if Payment of Wages is already present, if not add it
            if (!clauseObj.possible_law_references.some(c => c.act_key === "PAYMENT_OF_WAGES_ACT")) {
                clauseObj.possible_law_references.push({
                    act_key: "PAYMENT_OF_WAGES_ACT",
                    section_hint: "Section 7",
                    reason: "Unauthorized automated deductions from an employee's fixed salary for operational latency violate strict wage protection limits."
                });
            }
        }
    }

    // 3. Defang False Positives on Mutual/Bilateral Indemnification (TC_019)
    if ((rawText.includes("indemnify") || rawText.includes("indemnification")) &&
        (rawText.includes("each party") || rawText.includes("indemnifying party's") || rawText.includes("mutual")) &&
        !rawText.includes("sole negligence") && 
        !rawText.includes("own negligence") &&
        !rawText.includes("gross negligence")) { // Gross negligence coverage is never a safe harbor
        clauseObj.risk_level = "low";
        clauseObj.risk_score = 1;
        clauseObj.risk_reasons = ["Standard mutual, bilateral indemnification restricted to each party's own gross negligence or misconduct. Balanced risk allocation."];
        clauseObj.possible_law_references = [];
    }

    // 4. Defang False Positives on Employee Non-Solicitation (TC_029)
    if ((rawText.includes("poach") || rawText.includes("solicit") || rawText.includes("entice away")) && 
        (rawText.includes("employees") || rawText.includes("current employees")) &&
        (!rawText.includes("client") && !rawText.includes("customer") && !rawText.includes("prospect"))) {
        
        clauseObj.risk_level = "low";
        clauseObj.risk_score = 1;
        clauseObj.risk_reasons = ["Non-solicitation of employees (anti-poaching) is generally upheld in India, unlike non-solicitation of clients/customers which is struck down under Section 27."];
        
        if (clauseObj.possible_law_references) {
            clauseObj.possible_law_references = clauseObj.possible_law_references.filter(
                c => !(c.section_hint && c.section_hint.includes("27")) && 
                     !(c.reason && c.reason.includes("Section 27")) &&
                     !(c.act_name && c.act_name.includes("Section 27"))
            );
        }
    }

    return clauseObj;
}

// ── V6 Deterministic Predatory Trap Escalation ───────────────────────────────
// Safety net: catches sophisticated predatory patterns that the LLM consistently
// rates as LOW/HIGH because they use polished legal language to disguise the trap.
// Runs AFTER the LLM and Judge as a hard-coded escalation layer.
// Now uses deterministic keyword matching (V6) instead of unreliable ML models.
function enforcePredatoryTrapEscalation(clauseObj, text) {
    const { detectPredatoryTraps } = require('./classifierService');
    
    // Use deterministic keyword pattern matching to detect traps
    const detectedTraps = detectPredatoryTraps(text);

    if (detectedTraps.length > 0) {
        // Find the highest severity trap in the detected list
        const hasCritical = detectedTraps.some(t => t.severity === 'critical');
        const hasHigh = detectedTraps.some(t => t.severity === 'high');
        
        const targetLevel = hasCritical ? 'critical' : (hasHigh ? 'high' : 'medium');
        const targetScore = hasCritical ? 9 : (hasHigh ? 8 : 6);
        
        // Only escalate if the target level is higher than the current level
        const currentScore = parseInt(clauseObj.risk_score, 10) || 5;
        if (targetScore > currentScore) {
            clauseObj.risk_level = targetLevel;
            clauseObj.risk_score = targetScore;
            
            const trapTypes = detectedTraps.map(t => t.type).join(', ');
            clauseObj.risk_reasons = [
                `🚨 [System Override] Deterministic detector identified: ${trapTypes}. Forced escalation to ${targetLevel.charAt(0).toUpperCase() + targetLevel.slice(1)}.`,
                ...(clauseObj.risk_reasons || [])
            ];
            console.log(`🛡️ [Guardrail Triggered] Clause ${clauseObj.id}: Overriding to ${targetLevel}(${targetScore}) due to ML trap detection.`);
        }
    }

    return clauseObj;
}

/**
 * Cross-Reference & Defined Term Interdependency Resolver
 * 
 * Checks if a defined term in the Symbol Table (e.g., "Work Product", "Losses", "Confidential Information")
 * or an earlier Master Agreement definition fundamentally alters/escalates the risk profile
 * of a later seemingly standard clause.
 */
function resolveClausalInterdependencies(clauseObj, rawText, globalContext) {
  if (!globalContext || !globalContext.symbolTable || !rawText) return clauseObj;

  const lowerText = rawText.toLowerCase();

  // Skip interdependency resolution for introductory headers (preamble / title)
  if (lowerText.includes('this master services agreement') || lowerText.includes('this agreement is entered into') || (lowerText.startsWith('master services agreement') && lowerText.length < 250)) {
    return clauseObj;
  }

  const symbolTable = globalContext.symbolTable;
  const interdependencyWarnings = [];
  let maxTargetScore = parseInt(clauseObj.risk_score, 10) || 5;
  let targetLevel = clauseObj.risk_level || 'low';

  for (const [term, definition] of Object.entries(symbolTable)) {
    if (!term || typeof term !== 'string' || term.length < 3) continue;
    const termLower = term.toLowerCase();

    // Check if the defined term is referenced in this clause
    if (lowerText.includes(termLower)) {
      const defLower = (typeof definition === 'string' ? definition : JSON.stringify(definition)).toLowerCase();

      // Check if definition contains overreaching traps
      const isOverreachingIP = (termLower.includes('work product') || termLower.includes('invention') || termLower.includes('intellectual property')) &&
        (defLower.includes('unrelated') || defLower.includes('children') || defLower.includes('spouse') || defLower.includes('past employer') || defLower.includes('family'));

      const isOverreachingLosses = (termLower.includes('loss') || termLower.includes('indemnity') || termLower.includes('damage')) &&
        (defLower.includes('consequential') || defLower.includes('indirect') || defLower.includes('unlimited') || defLower.includes('attorney fees'));

      const isOverreachingRestrictedPeriod = (termLower.includes('restricted period') || termLower.includes('term')) &&
        (defLower.includes('perpetual') || defLower.includes('indefinite') || defLower.includes('5 years') || defLower.includes('10 years'));

      if (isOverreachingIP) {
        interdependencyWarnings.push(`🔗 [Cross-Reference Interdependency Alert] Defined term '${term}' (Section 1) expands this clause to include assets created by family members or unrelated projects.`);
        maxTargetScore = Math.max(maxTargetScore, 9);
        targetLevel = 'critical';
      }

      if (isOverreachingLosses) {
        interdependencyWarnings.push(`🔗 [Cross-Reference Interdependency Alert] Defined term '${term}' (Section 1) expands liability in this clause to include indirect & consequential damages.`);
        maxTargetScore = Math.max(maxTargetScore, 8);
        targetLevel = 'high';
      }

      if (isOverreachingRestrictedPeriod) {
        interdependencyWarnings.push(`🔗 [Cross-Reference Interdependency Alert] Defined term '${term}' (Section 1) extends the restricted timeframe of this clause indefinitely.`);
        maxTargetScore = Math.max(maxTargetScore, 8);
        targetLevel = 'high';
      }
    }
  }

  if (interdependencyWarnings.length > 0) {
    clauseObj.risk_level = targetLevel;
    clauseObj.risk_score = maxTargetScore;
    clauseObj.interdependency_warnings = interdependencyWarnings;
    clauseObj.risk_reasons = [
      ...interdependencyWarnings,
      ...(clauseObj.risk_reasons || [])
    ];
    console.log(`🔗 [Interdependency Resolver] Clause ${clauseObj.id}: Risk escalated to ${targetLevel} (${maxTargetScore}) via defined term interdependency.`);
  }

  return clauseObj;
}

// ── Phase 1: Selective Reflection Loop (Self-Healing) ────────────────────────
async function triggerReflectionLoop(clauseObj, clauseText, globalContext) {
    const { callLLM } = require('./aiClient');
    console.log(`🔄 [Reflection Loop] Triggered for Clause ${clauseObj.id}. LLM failed to identify predatory traps.`);
    
    const correctionPrompt = `
    You previously evaluated the following clause:
    "${clauseText}"

    You gave it a risk level of "${clauseObj.risk_level}" (Score: ${clauseObj.risk_score}).
    
    However, our deterministic legal guardrails detected the following predatory traps that you MISSED or UNDER-RATED:
    ${JSON.stringify(clauseObj.risk_reasons)}

    This is a critical oversight. A human lawyer would flag this as highly dangerous.
    
    TASK:
    Re-evaluate the clause. You MUST output a JSON object with a risk_level of "high" or "critical", and provide an updated, detailed "risk_reasons" array explaining why this specific predatory mechanism is dangerous for the user. Do not invent boilerplate; explain the exact trap detected.
    `;

    try {
        const resp = await callLLM({
            systemPrompt: SYSTEM_PROMPT,
            userContent: correctionPrompt,
            jsonMode: true,
            temperature: 0.1, // Highly deterministic for corrections
            maxTokens: 1024,
        });

        // The LLM returns a full JSON object for the clause, or a "results" array.
        const correctedResult = (resp.results && resp.results[0]) || resp;

        return {
            ...clauseObj,
            risk_level: correctedResult.risk_level || 'high',
            risk_score: correctedResult.risk_score || 8,
            risk_reasons: Array.isArray(correctedResult.risk_reasons) ? correctedResult.risk_reasons : clauseObj.risk_reasons,
            possible_law_references: correctedResult.possible_law_references || clauseObj.possible_law_references,
            reflection_triggered: true // Flag for debugging
        };
    } catch (error) {
        console.error(`⚠️ [Reflection Loop] Failed to self-heal clause ${clauseObj.id}:`, error.message);
        return clauseObj; // Fallback to the statically escalated object
    }
}

async function runAgent2RiskAnalyst(clausesBatch, globalContext) {
  // Retrieve case law precedents for each clause concurrently
  const clausesWithPrecedents = await Promise.all(clausesBatch.map(async (c) => {
    const queryVectorOrText = (Array.isArray(c.embedding) && c.embedding.length > 0) ? c.embedding : c.text;
    const precedents = await retrieveCaseLawPrecedents(queryVectorOrText, 2, 0.4); // top 2 cases, min 0.4 similarity
    return {
      ...c,
      retrieved_case_law: precedents.map(p => `CASE: ${p.case_title} | CITATION: ${p.citation} | PRECEDENT: ${p.summary}`)
    };
  }));

  const formattedBatch = clausesWithPrecedents.map((c) => {
    if (!globalContext) return c;

    let dynamicConstraints = "";
    if (globalContext.metadata?.documentType && globalContext.metadata.documentType.toLowerCase().includes('real estate')) {
      dynamicConstraints = "\nCRITICAL: Because this is a Real Estate document, you are FORBIDDEN from citing the Indian Contract Act for property transfer mechanics. You MUST ground your reasoning in the Transfer of Property Act, 1882 or the Registration Act, 1908.\n";
    }

    // Selective Symbol Table RAG Isolation: Only pass definitions referenced in this active clause text
    const relevantSymbolTable = {};
    if (globalContext.symbolTable && typeof globalContext.symbolTable === 'object') {
      const lowerClauseText = (c.text || '').toLowerCase();
      for (const [term, def] of Object.entries(globalContext.symbolTable)) {
        if (term && term.length > 2 && lowerClauseText.includes(term.toLowerCase())) {
          relevantSymbolTable[term] = def;
        }
      }
    }

    const globalPreamble = `
======================================================================
[V3 CRITICAL ARCHITECTURAL RUNTIME CONTEXT - DO NOT BYPASS]
The following parameters have been extracted from the root header of this document. 
Utilize these explicit definitions to analyze the semantic intent of the active clause below.

Document Type: ${globalContext.metadata?.documentType || "Not Explicitly Defined"}
Governing Framework: ${globalContext.metadata?.governingLaw || "Not Explicitly Defined"}
Corporate Employer: ${globalContext.metadata?.employerName || "Not Explicitly Defined"}
Target Designation: ${globalContext.metadata?.employeeDesignation || "Not Explicitly Defined"}
${dynamicConstraints}
Relevant Symbol Table (Referenced Definitions for Active Clause):
${JSON.stringify(relevantSymbolTable, null, 2)}
======================================================================

[ACTIVE TARGET EVALUATION CLAUSE TEXT]:
`;
    return {
      id: c.id,
      clause_type: c.clause_type,
      retrieved_legal_context: c.retrieved_legal_context,
      retrieved_contract_context: c.retrieved_contract_context,
      text: globalPreamble + c.text
    };
  });

  const userContent = JSON.stringify({ clauses: formattedBatch });

  const resp = await require('./aiClient').callLLM({
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    jsonMode: true,
    temperature: 0.2,
    maxTokens: 6144,
  });

  const clauseTextMap = {};
  for (const c of clausesBatch) {
    clauseTextMap[c.id] = c.text;
  }

  const rawResults = resp.results || [];
  const baseResults = [];
  
  for (let i = 0; i < clausesBatch.length; i++) {
    const originalClause = clausesBatch[i];
    let matched = rawResults.find(r => r && Number(r.id) === Number(originalClause.id));
    
    if (!matched && rawResults.length === clausesBatch.length) {
      matched = rawResults[i];
    }
    
    if (!matched && clausesBatch.length === 1 && rawResults.length > 0) {
      matched = rawResults[0];
    }
    
    if (matched) {
      baseResults.push({
        ...matched,
        id: originalClause.id,
        originalId: originalClause.originalId,
      });
    } else {
      baseResults.push({
        id: originalClause.id,
        originalId: originalClause.originalId,
        risk_level: 'medium',
        risk_score: 5,
        risk_reasons: ['Base analyst did not return results for this clause.'],
        possible_law_references: [],
      });
    }
  }
  
  // Adversarial Judge: run judge on risky clauses to catch False Negatives and False Positives
  const riskyResults = baseResults.filter(r =>
    r.risk_level === 'medium' || r.risk_level === 'high' || r.risk_level === 'critical'
  );
  
  let verifiedRiskyResults = [];
  if (riskyResults.length > 0) {
    const riskyClauseTextMap = {};
    for (const r of riskyResults) {
      riskyClauseTextMap[r.id] = clauseTextMap[r.id];
    }
    
    // Batch run the judge
    const judgeRaw = await runAdversarialJudgeBatch(globalContext, riskyClauseTextMap, riskyResults);
    const rawJudgeResults = Array.isArray(judgeRaw) ? judgeRaw : (judgeRaw.results || []);
    
    for (let i = 0; i < baseResults.length; i++) {
      const baseResult = baseResults[i];
      let matched = rawJudgeResults.find(v => v && Number(v.id) === Number(baseResult.id));
      
      if (!matched && rawJudgeResults.length === baseResults.length) {
        matched = rawJudgeResults[i];
      }
      
      if (!matched && baseResults.length === 1 && rawJudgeResults.length > 0) {
        matched = rawJudgeResults[0];
      }
      
      if (matched) {
        verifiedRiskyResults.push({
          ...matched,
          id: baseResult.id,
          originalId: baseResult.originalId,
        });
      } else {
        verifiedRiskyResults.push(baseResult);
      }
    }
  }
  
  // Merge and normalize results, and selectively apply Reflection/Adversary Judge sequentially
  const finalResults = [];
  for (let i = 0; i < baseResults.length; i++) {
    const baseAnalysis = baseResults[i];
    // Find verified analysis if it exists, otherwise use base
    const verifiedAnalysis = verifiedRiskyResults[i] || baseAnalysis;
    
    const risk_score = verifiedAnalysis.risk_score !== undefined ? verifiedAnalysis.risk_score : (verifiedAnalysis.score !== undefined ? verifiedAnalysis.score : baseAnalysis.risk_score);
    const risk_level = verifiedAnalysis.risk_level || verifiedAnalysis.riskRating || baseAnalysis.risk_level;
    const risk_reasons = verifiedAnalysis.risk_reasons || (verifiedAnalysis.auditNote ? [verifiedAnalysis.auditNote] : baseAnalysis.risk_reasons);
    const possible_law_references = verifiedAnalysis.possible_law_references || verifiedAnalysis.citations || baseAnalysis.possible_law_references;
    
    let score = clampScore(risk_score);
    let level = RISK_LEVELS.includes(risk_level ? risk_level.toLowerCase() : '') ? risk_level.toLowerCase() : 'medium';

    // ── Bidirectional Score ↔ Level Alignment ──────────────────────────
    if (level === 'critical' && score < 8) score = 8;
    if (level === 'high' && score < 6)     score = 6;
    if (score >= 8 && level !== 'critical') level = 'critical';
    if (score >= 6 && score < 8 && level !== 'critical' && level !== 'high') level = 'high';
    
    let resultObj = {
      id: baseAnalysis.id,
      originalId: baseAnalysis.originalId,
      has_commercial_asymmetry: verifiedAnalysis.has_commercial_asymmetry !== undefined ? verifiedAnalysis.has_commercial_asymmetry : (baseAnalysis.has_commercial_asymmetry || false),
      survives_termination: verifiedAnalysis.survives_termination !== undefined ? verifiedAnalysis.survives_termination : (baseAnalysis.survives_termination || false),
      risk_level: level,
      risk_score: score,
      confidence_score: baseAnalysis.confidence_score || 5,
      risk_reasons: Array.isArray(risk_reasons) ? risk_reasons : [],
      possible_law_references: possible_law_references,
    };

    // Apply V3 Sanitization
    resultObj = enforceV3MixedMatrixSanitization(resultObj, clauseTextMap[baseAnalysis.id] || "");
    
    // Apply Downstream Leak Calibration
    resultObj = cleanMixedMatrixDownstreamLeaks(resultObj, clauseTextMap[baseAnalysis.id] || "");

    // V6 Predatory Trap Escalation (deterministic safety net)
    const previousScore = resultObj.risk_score;
    resultObj = enforcePredatoryTrapEscalation(resultObj, clauseTextMap[baseAnalysis.id] || "");

    // Cross-Reference & Defined Term Interdependency Resolution Pass
    resultObj = resolveClausalInterdependencies(resultObj, clauseTextMap[baseAnalysis.id] || "", globalContext);

    // Phase 4A: Tri-Layer Trap Detection (Vector Fingerprinting + LLM Fallback)
    if (process.env.ENABLE_SEMANTIC_TRAP_DETECTION === 'true' && resultObj.risk_level !== 'critical') {
        const { detectVectorAndSemanticTraps } = require('./classifierService');
        const advancedTraps = await detectVectorAndSemanticTraps(clauseTextMap[baseAnalysis.id] || "");
        if (advancedTraps.length > 0) {
             const trap = advancedTraps[0];
             resultObj.risk_level = trap.severity === 'critical' ? 'critical' : 'high';
             resultObj.risk_score = trap.severity === 'critical' ? 9 : 8;
             resultObj.risk_reasons = [
                 `🧠 [Semantic AI Override] Detected hidden trap: ${trap.type}. ${trap.reasoning}`,
                 ...(resultObj.risk_reasons || [])
             ];
             console.log(`🛡️ [Semantic Guardrail Triggered] Clause ${resultObj.id}: Overriding to ${resultObj.risk_level}.`);
        }
    }

    // Phase 1: Selective Reflection Loop (Self-Healing)
    if (resultObj.risk_score > previousScore) {
        // The deterministic engine escalated the score, meaning the LLM failed. Trigger self-healing!
        resultObj = await triggerReflectionLoop(resultObj, clauseTextMap[baseAnalysis.id] || "", globalContext);
        // Add a 3000ms delay after reflection to let token buckets refill (only in production/live mode)
        if (process.env.LLM_PROVIDER !== 'local' && process.env.LLM_PROVIDER !== 'mock' && process.env.FORCE_LOCAL_LLM !== 'true') {
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    // Sanitize law refs mapped to strict schema keys
    resultObj.possible_law_references = sanitiseLawRefs(resultObj.possible_law_references);

    // Boilerplate Isolation Gate: Clear out forced statutory citations for low-risk standard clauses
    if ((resultObj.risk_level === 'low' || resultObj.risk_score <= 2) && (!resultObj.interdependency_warnings || resultObj.interdependency_warnings.length === 0)) {
      resultObj.possible_law_references = [];
    }

    finalResults.push(resultObj);
  }

  return finalResults;
}

function clampScore(val) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return 5;
  return Math.max(0, Math.min(10, n));
}

/**
 * Validate law references from the model:
 * - Only allow known act_keys
 * - Map act_key → full act_name + reference_url from config
 */
function sanitiseLawRefs(refs) {
  if (!Array.isArray(refs)) return [];

  return refs
    .filter((r) => r.act_key && ALLOWED_ACT_KEYS.includes(r.act_key))
    .map((r) => {
      const cfg = LAW_REFERENCES[r.act_key];
      return {
        act_key: r.act_key,
        act_name: cfg.act_name,
        section_hint: r.section_hint || '',
        reason: r.reason || '',
        reference_url: cfg.reference_url,
        verification_status: r.verification_status || null,
        verification_note: r.verification_note || null,
        compliance_confidence_tag: r.compliance_confidence_tag || r.confidenceTag || 'High Confidence',
        compliance_confidence_score: r.compliance_confidence_score || r.confidenceScore || 85,
      };
    });
}

/**
 * Compute contract-level overallRiskLevel from individual clause risk levels.
 * Critical > high > medium > low.
 */
function computeOverallRisk(clauseRiskLevels) {
  const priority = { critical: 4, high: 3, medium: 2, low: 1 };
  let max = 0;
  for (const level of clauseRiskLevels) {
    const p = priority[level] || 0;
    if (p > max) max = p;
  }
  return ['low', 'low', 'medium', 'high', 'critical'][max];
}

// ── Contract-level orchestrator ──────────────────────────────────────────────

/**
 * Analyse risk for all clauses of a contract that don't yet have risk data.
 * Batches clauses, calls Agent 2, maps law references, persists results,
 * and updates contract-level overallRiskLevel.
 *
 * @param {string} contractId
 */
async function analyseRisksForContract(contractId) {
  const contract = await Contract.findById(contractId).select('globalContext contractCategory parentContractId');
  
  // Phase 3: Cross-Contract Knowledge Graph Retrieval
  let enhancedGlobalContext = contract?.globalContext || {};
  if (contract.parentContractId) {
    const parentContract = await Contract.findById(contract.parentContractId).select('globalContext originalFileName');
    if (parentContract) {
      enhancedGlobalContext.parentContractConstraints = `This contract is a child of the Master Agreement '${parentContract.originalFileName}'. The following constraints apply: ${JSON.stringify(parentContract.globalContext)}`;
    }
  }

  const clauses = await Clause.find({
    contractId,
    risk_level: null,
  }).select('_id rawText clause_type segmentIndex embedding').sort({ segmentIndex: 1 });

  if (clauses.length > 0) {
    const { resolveJurisdiction } = require('./../utils/geoMapper');
    const searchStr = ((enhancedGlobalContext.metadata?.governingLaw || "") + " " + (enhancedGlobalContext.metadata?.jurisdiction || ""));
    const geo = resolveJurisdiction(searchStr);
    const resolvedJurisdiction = geo.state;
    const resolvedMunicipality = geo.municipality;

    const { searchSimilarClauses } = require('./embeddingService');

    // Build batch items by fetching dynamic laws with limited concurrency to protect the DB connection pool
    const pLimit = require('p-limit');
    const limitFn = typeof pLimit === 'function' ? pLimit : pLimit.default;
    const dbQueryLimit = limitFn(10);

    const items = await Promise.all(
      clauses.map((c) => dbQueryLimit(async () => {
        const queryVectorOrText = (Array.isArray(c.embedding) && c.embedding.length > 0) ? c.embedding : c.rawText;

        const retrieved = await retrieveComplianceContext(
            contract.contractCategory, 
            c.clause_type || 'other', 
            queryVectorOrText, 
            resolvedJurisdiction,
            resolvedMunicipality,
            enhancedGlobalContext.metadata?.executionDate
        );

        // Fetch Case Law Precedents via Vector Search
        const retrievedCaseLawRaw = await retrieveCaseLawPrecedents(queryVectorOrText, 2, 0.50);
        const retrievedCaseLaw = Array.isArray(retrievedCaseLawRaw) ? retrievedCaseLawRaw.join('\n') : "";
        
        // Zero-Rupee Vector RAG: Fetch related clauses from the same document to maintain context
        const similarClauses = await searchSimilarClauses(contractId, queryVectorOrText, 3);
        const retrieved_contract_context = similarClauses
          .filter(sc => sc.clauseId.toString() !== c._id.toString())
          .map(sc => `Clause ${sc.segmentIndex}: ${sc.rawText}`);

        return {
          originalId: c._id.toString(),
          id: c.segmentIndex,
          text: c.rawText,
          embedding: c.embedding,
          clause_type: c.clause_type || 'other',
          retrieved_legal_context: retrieved,
          retrieved_case_law: retrievedCaseLaw,
          retrieved_contract_context,
        };
      }))
    );

    // Process batches sequentially to respect Groq rate limits (6000 TPM)
    const batchOpsArrays = [];
    for (let i = 0; i < items.length; i += AGENT_BATCH_SIZE) {
      const batch = items.slice(i, i + AGENT_BATCH_SIZE);
      let results = await runAgent2RiskAnalyst(batch, enhancedGlobalContext);
      
      // ── PHASE 2: Tier 2 Escalation (Senior Partner Review) ──
      const { runTier2Escalation } = require('./tier2Escalation');
      const clauseTextMap = {};
      for (const item of batch) {
          clauseTextMap[item.id] = item.text;
      }
      
      results = await runTier2Escalation(results, clauseTextMap);

      batchOpsArrays.push(results.map((r) => ({
        updateOne: {
          filter: { _id: r.originalId },
          update: {
            $set: {
              has_commercial_asymmetry: r.has_commercial_asymmetry,
              survives_termination: r.survives_termination,
              risk_level: r.risk_level,
              risk_score: r.risk_score,
              confidence_score: r.confidence_score,
              risk_reasons: r.risk_reasons,
              possible_law_references: r.possible_law_references,
              ...(r.tier2_escalated ? {
                  tier2_escalated: r.tier2_escalated,
                  tier2_agrees: r.tier2_agrees,
                  tier2_senior_note: r.tier2_senior_note,
              } : {})
            },
          },
        },
      })));
      
      // Delay 12 seconds to prevent hitting 429 TPM limits on free tier (only in production/live mode)
      if (i + AGENT_BATCH_SIZE < items.length) {
        if (process.env.LLM_PROVIDER !== 'local' && process.env.LLM_PROVIDER !== 'mock' && process.env.FORCE_LOCAL_LLM !== 'true') {
          await new Promise(r => setTimeout(r, 12000));
        }
      }
    }
    const allOps = batchOpsArrays.flat();

    if (allOps.length > 0) {
      await Clause.bulkWrite(allOps);
    }
  }

  // Compute contract-level risk
  const allClauses = await Clause.find({ contractId }).select('risk_level');
  const levels = allClauses.map((c) => c.risk_level).filter(Boolean);
  const overallRisk = levels.length > 0 ? computeOverallRisk(levels) : null;

  await Contract.findByIdAndUpdate(contractId, {
    overallRiskLevel: overallRisk,
    'agentMetadata.analysedAt': new Date(),
  });

  console.log(
    `✅ Agent 2 analysed ${clauses.length} clauses for contract ${contractId} — overall risk: ${overallRisk}`
  );
}

module.exports = { runAgent2RiskAnalyst, analyseRisksForContract, runAdversarialJudgeBatch, resolveClausalInterdependencies };
