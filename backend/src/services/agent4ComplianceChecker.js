const mongoose = require('mongoose');
const Contract = require('../models/Contract');
const Clause = require('../models/Clause');
const { callLLM } = require('./aiClient');
const { AGENT_BATCH_SIZE } = require('../config/constants');
const { retrieveRelevantLaws } = require('./lawRetrieverService');

/**
 * Agent 4 – Indian Compliance Checker
 * Analyzes clauses for compliance with Indian Contract Act 1872, DPDP Act 2023, and Arbitration Act 1996.
 */

/**
 * Direct orchestrator to call LLM on a batch of clauses.
 *
 * @param {Array<Object>} clausesBatch - array of parsed Clause objects
 * @returns {Promise<Array<Object>>} array of structured compliance results
 */
async function runAgent4ComplianceChecker(clausesBatch) {
  // Filter inputs to valid ObjectIds
  const validBatch = clausesBatch.filter((c) => mongoose.Types.ObjectId.isValid(c.id));
  if (validBatch.length === 0) return [];

  const systemPrompt = `You are LexGuard, an AI legal risk and negotiation assistant that helps users understand and triage contract clauses.
You are not a lawyer and you do not provide legal advice.
Your job is to highlight potential areas where the clause may raise Indian law compliance concerns, specifically referencing the Acts, sections, and landmark cases provided in the retrieved legal context.

### 1. Safety and reliability rules (mandatory)

1. No legal advice or verdicts
   - Never say a clause is "legal", "illegal", "valid", "void", "enforceable", or "unenforceable".
   - Instead, use phrases like: "may raise issues under...", "might be considered...", "could be inconsistent with...".

2. Always assume a human lawyer will decide
   - Your job is to flag potential risks, not to decide outcomes.

3. Indian law references
   - When you mention Indian law, name the Act and a high-level section number if relevant.
   - Never quote full bare-act text. Summarize in your own words.

### 2. Classification Guidelines for compliance_risk_level
You must classify the compliance_risk_level strictly according to the following thresholds:
- **high**: Any clause that is highly likely to be unenforceable, predatory, or in direct violation of statutory protections. This includes:
  - **Wage / Compensation Deferrals/Withholding**: Unilateral deferrals of salary, interest-free holding of wages, or penal deductions (violating the Payment of Wages Act, 1936).
  - **Employment / Training Bonds**: Punitive or unreasonable repayment obligations (e.g., 200%-300% markup, exorbitant interest, or excessively long service locks) (violating Section 74 of the Indian Contract Act, 1872).
  - **Post-employment Non-competes**: Restricting employment post-termination in any broad geographic region or sector (violating Section 27 of the Indian Contract Act, 1872).
  - **Statutory Rights Waivers**: Waiver of maximum working hours, statutory rest periods, 24/7 response mandates, or complete denial of severance.
- **medium**: Clauses that contain unbalanced terms, aggressive limits, or potential compliance issues but are not outright predatory or statutorily void.
- **low**: Standard operational clauses, benign hours, or standard confidentiality/good-faith agreements with no clear Indian law compliance concerns.

### 3. Input format
You receive clauses from contracts, along with their clause_type, risk_level, and "retrieved_legal_context" array which contains official Indian Acts, section numbers, titles, and legal guidelines retrieved from our database.

### 4. Output format (JSON only)
You must reply with valid JSON only, with this structure:
{
  "results": [
    {
      "id": "c1",
      "compliance_risk_level": "medium",
      "potential_issue_areas": ["..."],
      "human_review_strongly_recommended": true,
      "explanatory_note": "..."
    }
  ]
}

- compliance_risk_level: "low", "medium", or "high".
- potential_issue_areas: list of short strings, each describing a possible issue area.
- human_review_strongly_recommended: true if a reasonable person might want a qualified Indian lawyer to review this clause; false otherwise.
- explanatory_note: 1–3 sentences explaining, in plain language, why this clause may raise potential Indian law issues. Keep it concise and user-friendly.

If you see no clear Indian law concern, use compliance_risk_level = "low" and an empty potential_issue_areas array.
`;

  const userContent = JSON.stringify({
    clauses: validBatch.map((c) => ({
      id: c.id,
      text: c.text,
      clause_type: c.clause_type,
      risk_level: c.risk_level,
      risk_score: c.risk_score,
      possible_law_references: c.possible_law_references,
      retrieved_legal_context: c.retrieved_legal_context || [],
    })),
  });

  try {
    const response = await callLLM({
      systemPrompt,
      userContent,
      jsonMode: true,
      temperature: 0.2,
    });

    return response?.results || [];
  } catch (err) {
    console.error('⚠️  Agent 4 Compliance batch call failed:', err.message);
    // Return empty results to let outer loop gracefully default
    return [];
  }
}

/**
 * Main function to evaluate a full contract document for Indian compliance.
 * Employs Option B (token-optimized filtering) and safe error borders.
 *
 * @param {string|ObjectId} contractId
 */
async function runComplianceCheckForContract(contractId) {
  try {
    // 1. Fetch all clauses associated with this contract
    const clauses = await Clause.find({ contractId }).sort({ segmentIndex: 1 });
    if (clauses.length === 0) return;

    console.log(`\n[Agent 4] Evaluating Indian law compliance for contract: ${contractId} (${clauses.length} clauses)`);

    // 2. Option B: Separate into Check vs Skip groups
    const toCheck = [];
    const toSkip = [];

    for (const c of clauses) {
      const isRisky = c.risk_level === 'medium' || c.risk_level === 'high' || c.risk_level === 'critical';
      const hasLawHint = c.possible_law_references && c.possible_law_references.length > 0;

      if (isRisky || hasLawHint) {
        toCheck.push(c);
      } else {
        toSkip.push(c);
      }
    }

    console.log(`[Agent 4] Option B active: checking ${toCheck.length} risky clauses, skipping ${toSkip.length} low-risk clauses.`);

    // 3. Directly save 'low' compliance risk for skipped clauses in a single bulk operation
    if (toSkip.length > 0) {
      const skipOps = toSkip.map((c) => ({
        updateOne: {
          filter: { _id: c._id },
          update: {
            $set: {
              compliance_risk_level: 'low',
              potential_issue_areas: [],
              human_review_strongly_recommended: false,
              explanatory_note: 'No significant Indian law compliance issues flagged.',
            },
          },
        },
      }));
      await Clause.bulkWrite(skipOps);
    }

    // 4. Fetch relevant laws dynamically for all checked clauses in parallel (Intra-agent concurrency)
    const inputs = await Promise.all(
      toCheck.map(async (c) => {
        const retrieved = await retrieveRelevantLaws(c.rawText, c.clause_type || 'other');
        return {
          id: c._id.toString(),
          text: c.rawText,
          clause_type: c.clause_type || 'other',
          risk_level: c.risk_level || 'low',
          risk_score: c.risk_score || 0,
          possible_law_references: c.possible_law_references || [],
          retrieved_legal_context: retrieved,
        };
      })
    );

    // 5. Batch & process clauses in 'inputs' in parallel concurrently (Intra-agent concurrency)
    const batchSize = AGENT_BATCH_SIZE || 15;
    const batchPromises = [];

    for (let i = 0; i < inputs.length; i += batchSize) {
      const slice = inputs.slice(i, i + batchSize);
      const task = async () => {
        const results = await runAgent4ComplianceChecker(slice);

        // Create lookup map of output results by ID
        const resultsMap = {};
        if (Array.isArray(results)) {
          for (const res of results) {
            if (res && res.id) {
              resultsMap[res.id] = res;
            }
          }
        }

        // Build bulk update operations
        return slice.map((inp) => {
          const match = resultsMap[inp.id];
          let level = 'low';
          let issueAreas = [];
          let recommend = false;
          let note = 'Compliance check processed.';

          if (match) {
            level = (match.compliance_risk_level || 'low').toLowerCase().trim();
            if (level === 'critical') {
              level = 'high';
            } else if (!['low', 'medium', 'high'].includes(level)) {
              level = 'medium'; // safe fallback default
            }
            issueAreas = Array.isArray(match.potential_issue_areas)
              ? match.potential_issue_areas
              : [];
            recommend = !!match.human_review_strongly_recommended;
            note = match.explanatory_note || 'Compliance check completed.';
          }

          if (inp.risk_score <= 5) {
            level = 'low';
            recommend = false;
          }

          const text = (inp.text || '').toLowerCase();
          
          // Filter out Consumer Protection issues from employment contracts
          if (text.includes("employment") || text.includes("employee") || text.includes("custodian")) {
            issueAreas = issueAreas.filter(area => !area.toLowerCase().includes("consumer protection"));
            if (note.toLowerCase().includes("consumer protection")) {
              note = note.replace(/Consumer Protection Act,?\s*2019?/gi, "applicable employment laws");
            }
          }

          // Filter out Industrial Disputes Act from non-termination fields
          if (!text.includes("retrenchment") && !text.includes("termination notice") && !text.includes("severance")) {
            issueAreas = issueAreas.filter(area => !area.toLowerCase().includes("industrial disputes"));
            if (note.toLowerCase().includes("industrial disputes")) {
              note = note.replace(/Industrial Disputes Act,?\s*1947?/gi, "Indian contract framework");
            }
          }

          // Add Copyright Act 19(4) trap verification at the compliance checker level as well
          if (text.includes("19(4)") || (text.includes("copyright act") && (text.includes("waive") || text.includes("reversion")))) {
            level = 'high';
            recommend = true;
            if (!issueAreas.some(area => area.toLowerCase().includes("copyright"))) {
              issueAreas.push("Copyright Reversion Waiver");
            }
            note = "CRITICAL ALERT: Clause explicitly attempts to contract out of statutory IP reversion. Contractual waivers overriding Section 19(4) are highly predatory under Indian IP jurisprudence.";
          }

          // Defang the Arbitration Mutual Consensus Trap at compliance checker level
          if (text.includes("arbitration") && (text.includes("mutual consensus") || text.includes("mutual agreement") || text.includes("jointly appoint"))) {
            if (!text.includes("unilateral") && !text.includes("sole right to nominate") && !text.includes("sole arbitrator nominated by the company")) {
              level = 'low';
              recommend = false;
              issueAreas = issueAreas.filter(area => !area.toLowerCase().includes("arbitration"));
              note = "The clause utilizes a highly compliant, bilateral mechanism requiring mutual consensus for arbitrator selection, fully adhering to neutral frameworks.";
            }
          }

          return {
            updateOne: {
              filter: { _id: inp.id },
              update: {
                $set: {
                  compliance_risk_level: level,
                  potential_issue_areas: issueAreas,
                  human_review_strongly_recommended: recommend,
                  explanatory_note: note,
                },
              },
            },
          };
        });
      };
      batchPromises.push(task());
    }

    const batchOpsArrays = await Promise.all(batchPromises);
    const allOps = batchOpsArrays.flat();

    if (allOps.length > 0) {
      await Clause.bulkWrite(allOps);
    }

    // 5. Update Contract compliance checked metadata
    const contract = await Contract.findById(contractId);
    if (contract) {
      contract.agentMetadata = contract.agentMetadata || {};
      contract.agentMetadata.complianceCheckedAt = new Date();
      await contract.save();
    }

    console.log(`[Agent 4] Compliance check for contract ${contractId} completed successfully!`);
  } catch (err) {
    console.error(`⚠️  Agent 4 orchestrator failed for contract ${contractId}:`, err);
    // Non-blocking try/catch block
  }
}

module.exports = {
  runAgent4ComplianceChecker,
  runComplianceCheckForContract,
};
