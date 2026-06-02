const semanticChunker = require('../utils/semanticChunker');

/**
 * Heuristic-based contract clause splitter. Uses only code — no AI.
 * Now backed by SemanticChunker to protect against malformed documents and Context Collapse.
 *
 * @param {string} cleanedText - Output from textCleaner.
 * @returns {{ segmentIndex: number, rawText: string }[]}
 */
const splitClauses = (cleanedText) => {
  const parsedChunks = semanticChunker.chunkDocument(cleanedText);
  
  console.log(`[AST Compiler] Successfully parsed ${parsedChunks.length} distinct semantic chunks.`);

  // Map the new { text, type } objects into the legacy { segmentIndex, rawText } schema
  return parsedChunks.map((chunk, index) => ({
    segmentIndex: index,
    rawText: chunk.text
  }));
};

module.exports = { splitClauses };
