/**
 * Agent 0 - The Symbol Extractor (Graph RAG Compiler Pass)
 *
 * Scans the legal document using a Map-Reduce pattern to extract all explicitly
 * defined terms and compiles them into a lightweight JSON dictionary.
 */

const { callLLM } = require('./aiClient');
const pLimit = require('p-limit');

const limitFn = typeof pLimit === 'function' ? pLimit : pLimit.default;
// Throttle concurrency to avoid 429 Rate Limits on free tiers
const mapReduceLimiter = limitFn(2);

const AGENT_0_SYSTEM_PROMPT = `
You are Agent 0: The Symbol Extractor for a neurosymbolic legal AI.
Your sole task is to read the legal text and extract all explicitly defined terms into a strict JSON dictionary.

Look for patterns like:
- "...(hereinafter referred to as the 'Company')"
- "'Confidential Information' means..."
- Capitalized terms defined in a definitions schedule.

Return ONLY a valid JSON object where the key is the exact defined term, and the value is its precise definition or assignment.
Example: { "Restricted Period": "12 months following the Date of Separation", "Company": "TechCorp India Pvt Ltd" }

Do NOT include any markdown, introductory text, or explanations. If no terms are defined, return an empty object: {}
`;

/**
 * Build a global symbol table (dictionary) of defined terms using Map-Reduce.
 * 
 * @param {string} fullContractText 
 * @returns {Promise<Object>} The extracted dictionary
 */
async function buildGlobalSymbolTable(fullContractText) {
  const startTime = Date.now();
  if (!fullContractText) return {};

  const chunks = [];
  const CHUNK_SIZE = 10000;
  
  // 1. Always process the preamble / intro (first 20,000 chars) where inline definitions live
  const preamble = fullContractText.substring(0, 20000);
  for (let i = 0; i < preamble.length; i += CHUNK_SIZE) {
    chunks.push(preamble.substring(i, i + CHUNK_SIZE));
  }

  // 2. Hunt for "Definitions" headers deep in the document
  // Matches "Article 1 Definitions", "Schedule A: Definitions", "1.1 Definitions and Interpretation"
  const definitionHeaderRegex = /(?:article|section|clause|schedule|appendix|exhibit|part)?\s*[0-9a-z.]*\s*[:\-]?\s*(?:definitions? and interpretations?|definitions?)\b/gi;
  
  let match;
  // Track indices we've covered to avoid massive overlap
  const coveredZones = [{ start: 0, end: 20000 }];
  
  while ((match = definitionHeaderRegex.exec(fullContractText)) !== null) {
    const startIdx = match.index;
    
    // Check if this is already covered by previous zones
    if (coveredZones.some(z => startIdx >= z.start && startIdx <= z.end)) {
      continue;
    }
    
    // Found a new definitions block! Extract ~15,000 characters
    const endIdx = Math.min(startIdx + 15000, fullContractText.length);
    coveredZones.push({ start: startIdx, end: endIdx });
    
    const block = fullContractText.substring(startIdx, endIdx);
    for (let i = 0; i < block.length; i += CHUNK_SIZE) {
      chunks.push(block.substring(i, i + CHUNK_SIZE));
    }
  }

  console.log(`🧠 [Agent 0] Map-Reduce started. Shredded contract into ${chunks.length} compilation chunks.`);

  try {
    // Map: Extract definitions from each chunk concurrently (limited to 2 at a time)
    const extractionPromises = chunks.map((chunk, index) => {
      return mapReduceLimiter(async () => {
        try {
          const resp = await callLLM({
            systemPrompt: AGENT_0_SYSTEM_PROMPT,
            userContent: "Extract the defined terms from this text chunk:\n\n" + chunk,
            jsonMode: true,
            temperature: 0.1,
            maxTokens: 2000
          });
          
          if (resp && resp.results && Array.isArray(resp.results)) {
             // If local fallback triggered and returned default results array
             delete resp.results;
          }
          
          return resp || {};
        } catch (err) {
          console.error(`⚠️ [Agent 0] Chunk ${index + 1} extraction failed:`, err.message);
          return {}; // Graceful failure per chunk
        }
      });
    });

    const chunkResults = await Promise.all(extractionPromises);

    // Reduce: Merge all JSON objects into a single master dictionary
    const masterSymbolTable = chunkResults.reduce((acc, curr) => {
      return Object.assign(acc, curr);
    }, {});

    console.log(`✅ [Agent 0] Generated Global Symbol Table in ${Date.now() - startTime}ms. Extracted ${Object.keys(masterSymbolTable).length} entities.`);
    return masterSymbolTable;

  } catch (error) {
    console.error(`🔴 [Agent 0] Fatal Symbol Extraction Error:`, error.message);
    return {}; 
  }
}

module.exports = { buildGlobalSymbolTable };
