/**
 * Agent 5 - Contract Chat
 * 
 * Provides an interactive Q&A interface for a specific contract.
 */

const { callLLM } = require('./aiClient');
const Clause = require('../models/Clause');
const Contract = require('../models/Contract');

const SYSTEM_PROMPT = `You are LexGuard Chat (Agent 5), a highly intelligent legal assistant.
You are helping the user understand their uploaded contract. 
You are provided with the FULL TEXT of the contract clauses below, along with the user's question.

### Rules:
1. Provide accurate, helpful, and concise answers based strictly on the provided contract text.
2. If the answer is not in the contract, say so clearly. Do not hallucinate terms.
3. You are not a lawyer. Provide a standard disclaimer if the user asks for formal legal advice.
4. Format your response in clean Markdown.
5. YOU MUST output valid JSON only in the following format:
{
  "response": "Your markdown formatted answer here..."
}
`;

async function chatWithContract(contractId, userMessage) {
  // Fetch all clauses for context
  const clauses = await Clause.find({ contractId }).sort({ segmentIndex: 1 });
  if (!clauses || clauses.length === 0) {
    throw new Error('No clauses found for this contract. Please ensure it has been analyzed.');
  }

  // Build the context string
  let contextText = clauses.map(c => `[Clause ${c.segmentIndex + 1} - Type: ${c.clause_type || 'Unknown'}]\n${c.rawText}`).join('\n\n');

  // Truncate if insanely long (prevent token overflow)
  if (contextText.length > 50000) {
    contextText = contextText.substring(0, 50000) + '\\n...[TRUNCATED]';
  }

  const userContent = JSON.stringify({
    contract_context: contextText,
    user_question: userMessage
  });

  const resp = await callLLM({
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    jsonMode: true,
    temperature: 0.3,
    maxTokens: 2048,
  });

  return resp.response || "I'm sorry, I couldn't generate a response.";
}

module.exports = { chatWithContract };
