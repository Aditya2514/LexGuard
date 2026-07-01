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
  const { generateEmbedding } = require('./embeddingService');
  const targetId = typeof contractId === 'string' ? new mongoose.Types.ObjectId(contractId) : contractId;

  let contextText = '';
  try {
    // Generate embedding for the user's question
    const queryVector = await generateEmbedding(userMessage);

    // Perform vector search to find the top 5 most relevant clauses
    // Note: Requires an Atlas Vector Search index named "vector_index" on the "clauses" collection
    const relevantClauses = await Clause.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryVector,
          numCandidates: 50,
          limit: 5,
          filter: { contractId: targetId }
        }
      },
      {
        $project: {
          segmentIndex: 1,
          clause_type: 1,
          rawText: 1,
          risk_level: 1,
          plain_language_explanation: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ]);

    if (relevantClauses && relevantClauses.length > 0) {
      contextText = relevantClauses.map(c => 
        `[Clause ${c.segmentIndex + 1} - Type: ${c.clause_type || 'Unknown'} - Risk: ${c.risk_level || 'Unknown'}]\n${c.rawText}\nExplanation: ${c.plain_language_explanation || ''}`
      ).join('\n\n');
    } else {
      contextText = 'No highly relevant clauses found for this query.';
    }
  } catch (err) {
    console.warn('⚠️ Vector search failed, falling back to full text context.', err.message);
    
    // Fallback: use first 20 clauses to avoid overflowing token limit
    const clauses = await Clause.find({ contractId }).sort({ segmentIndex: 1 }).limit(20);
    if (!clauses || clauses.length === 0) {
      throw new Error('No clauses found for this contract. Please ensure it has been analyzed.');
    }
    contextText = clauses.map(c => `[Clause ${c.segmentIndex + 1} - Type: ${c.clause_type || 'Unknown'}]\n${c.rawText}`).join('\n\n');
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
