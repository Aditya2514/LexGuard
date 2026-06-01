/**
 * Agent 0 – Pre-Flight Global Context Extractor
 *
 * Scans the initial segment of a contract to extract structural
 * definitions, governing law, and parties.
 */

const { callLLM } = require('./aiClient');
const Contract = require('../models/Contract');

const PRE_FLIGHT_SYSTEM_PROMPT = `
Role: Elite Enterprise Legal Ontologist & Ingestion Preprocessor.
Task: Analyze the initial segments of the attached employment contract and build a deterministic Global Context JSON block.

You must strictly output a valid JSON object matching the schema below. Do NOT append introductory conversational text, markdown formatting blocks, or trailing commentary.

Required Schema:
{
  "metadata": {
    "documentType": "String (e.g., 'Employment Agreement', 'Real Estate Contract', 'Non-Disclosure Agreement')",
    "governingLaw": "String (e.g., 'Republic of India / State of Karnataka')",
    "executionDate": "String (ISO 8601 Date or YYYY-MM-DD)",
    "employerName": "String",
    "employeeDesignation": "String",
    "employeeAddress": "String (The physical city/state/country of the employee)",
    "companyAddress": "String (The physical city/state/country of the company)"
  }
}
`;

/**
 * Run the pre-flight LLM extraction pass on the first 12,000 characters of the raw text.
 *
 * @param {string} rawText
 * @returns {Promise<object>}
 */
async function runAgentPreFlight(rawText) {
  // Extract initial slice (first 20,000 characters) where recitals live
  const sampleText = (rawText || '').substring(0, 20000).trim();

  // If the contract is completely blank, return empty structured fallback
  if (!sampleText) {
    return {
      metadata: {
        governingLaw: null,
        employerName: null,
        employeeDesignation: null,
        employeeAddress: null,
        companyAddress: null,
      }
    };
  }

  try {
    const resp = await callLLM({
      systemPrompt: PRE_FLIGHT_SYSTEM_PROMPT,
      userContent: sampleText,
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 1000,
    });

    // Tail scan for governing law if missing
    if (!resp?.metadata?.governingLaw && rawText.length > 20000) {
      const tailText = rawText.slice(-5000).trim();
      if (tailText) {
        const tailResp = await callLLM({
          systemPrompt: PRE_FLIGHT_SYSTEM_PROMPT,
          userContent: tailText,
          jsonMode: true,
          temperature: 0.1,
          maxTokens: 1000,
        });
        if (tailResp?.metadata?.governingLaw) {
          if (!resp.metadata) resp.metadata = {};
          resp.metadata.governingLaw = tailResp.metadata.governingLaw;
        }
      }
    }

    // Ensure safe structured defaults in case of incomplete/partial object returns
    return {
      metadata: {
        documentType: resp?.metadata?.documentType || null,
        governingLaw: resp?.metadata?.governingLaw || null,
        executionDate: resp?.metadata?.executionDate || null,
        employerName: resp?.metadata?.employerName || null,
        employeeDesignation: resp?.metadata?.employeeDesignation || null,
        employeeAddress: resp?.metadata?.employeeAddress || null,
        companyAddress: resp?.metadata?.companyAddress || null,
      }
    };
  } catch (err) {
    console.error('⚠️  Pre-Flight LLM extraction failed. Returning safe defaults.', err.message);
    return {
      metadata: {
        documentType: null,
        governingLaw: null,
        employerName: null,
        employeeDesignation: null,
        employeeAddress: null,
        companyAddress: null,
      }
    };
  }
}

/**
 * Extract and save global context for a specific contract.
 *
 * @param {string} contractId
 */
async function extractGlobalContextForContract(contractId) {
  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found.`);
  }

  console.log(`🧠 [Pre-Flight Agent] Running global context extraction for: ${contract.originalFileName}`);

  const globalContext = await runAgentPreFlight(contract.rawText);

  // Persist to MongoDB
  await Contract.findByIdAndUpdate(contractId, {
    globalContext,
    'agentMetadata.preFlightExtractedAt': new Date(),
    'agentMetadata.isPreFlightComplete': true,
  });

  console.log(`✅ [Pre-Flight Agent] Global context persisted for contract ${contractId}`);
}

module.exports = { runAgentPreFlight, extractGlobalContextForContract };
