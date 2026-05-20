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
    "governingLaw": "String (e.g., 'Republic of India / State of Karnataka')",
    "employerName": "String",
    "employeeDesignation": "String"
  },
  "globalDefinitions": {
    "ACTUAL_DEFINED_TERM_1": "Precise structural definition of ACTUAL_DEFINED_TERM_1 as written in the contract",
    "ACTUAL_DEFINED_TERM_2": "Precise structural definition of ACTUAL_DEFINED_TERM_2 as written in the contract"
  }
}

Under 'globalDefinitions', map each actual defined term name (e.g., 'ProprietaryInformation', 'OperationalDeficitEvent', 'IntellectualProperty') dynamically as a unique key, and assign its exact textual definition as its string value. Do NOT use the placeholder string 'keyTermName' as a key; instead, generate the key names dynamically based on the terms defined in the contract.
`;

/**
 * Run the pre-flight LLM extraction pass on the first 12,000 characters of the raw text.
 *
 * @param {string} rawText
 * @returns {Promise<object>}
 */
async function runAgentPreFlight(rawText) {
  // Extract initial slice (first 12,000 characters) where recitals and definitions live
  const sampleText = (rawText || '').substring(0, 12000).trim();

  // If the contract is completely blank, return empty structured fallback
  if (!sampleText) {
    return {
      metadata: {
        governingLaw: null,
        employerName: null,
        employeeDesignation: null,
      },
      globalDefinitions: {},
    };
  }

  try {
    const resp = await callLLM({
      systemPrompt: PRE_FLIGHT_SYSTEM_PROMPT,
      userContent: sampleText,
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 1500,
    });

    // Ensure safe structured defaults in case of incomplete/partial object returns
    return {
      metadata: {
        governingLaw: resp?.metadata?.governingLaw || null,
        employerName: resp?.metadata?.employerName || null,
        employeeDesignation: resp?.metadata?.employeeDesignation || null,
      },
      globalDefinitions: resp?.globalDefinitions || {},
    };
  } catch (err) {
    console.error('⚠️  Pre-Flight LLM extraction failed. Returning safe defaults.', err.message);
    return {
      metadata: {
        governingLaw: null,
        employerName: null,
        employeeDesignation: null,
      },
      globalDefinitions: {},
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
