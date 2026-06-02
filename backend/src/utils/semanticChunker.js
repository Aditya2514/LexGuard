class SemanticChunker {
  constructor(maxTokens = 1500) {
    this.maxTokens = maxTokens;
  }

  /**
   * Cleans hidden characters and normalizes concatenated strings.
   */
  normalizeText(rawText) {
    // Replace zero-width spaces, non-breaking spaces, and erratic tabs
    let clean = rawText.replace(/[\u200B-\u200D\uFEFF]/g, '');
    clean = clean.replace(/\r\n/g, '\n');
    
    // Fix concatenated section numbers (e.g., "courts.16. GOVERNING" -> "courts.\n\n16. GOVERNING")
    // This regex looks for a lowercase letter or period, followed by a number and a period.
    clean = clean.replace(/([a-z.])(\d{1,2}\.\d{0,2}\s*[A-Z])/g, '$1\n\n$2');
    
    // Fix missing spaces before major headers like "ARTICLE" or "SECTION"
    clean = clean.replace(/([a-z.])(ARTICLE|SECTION|SCHEDULE)/g, '$1\n\n$2');

    return clean;
  }

  /**
   * The Two-Pass Chunking Algorithm
   */
  chunkDocument(rawText) {
    const normalizedText = this.normalizeText(rawText);

    // PASS 1: Heuristic Split (Split by double newlines or forced section breaks)
    const initialChunks = normalizedText.split(/\n{2,}/);
    const finalChunks = [];

    // PASS 2: Token Overflow Protection
    // If a chunk is still too massive (e.g., a 4-page schedule), recursively split it by paragraphs or sentences
    for (const chunk of initialChunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;

      // Rough approximation: 1 token ~= 4 characters
      if (trimmed.length / 4 > this.maxTokens) {
        const subChunks = this.splitBySentence(trimmed);
        finalChunks.push(...subChunks);
      } else {
        finalChunks.push({ text: trimmed, type: 'semantic_block' });
      }
    }

    return finalChunks;
  }

  splitBySentence(massiveChunk) {
    // Split by sentence-ending punctuation, keeping the punctuation
    const sentences = massiveChunk.match(/[^.!?]+[.!?]+/g) || [massiveChunk];
    const subChunks = [];
    let currentBlock = "";

    for (const sentence of sentences) {
      if ((currentBlock.length + sentence.length) / 4 > this.maxTokens) {
        subChunks.push({ text: currentBlock.trim(), type: 'overflow_block' });
        currentBlock = sentence;
      } else {
        currentBlock += " " + sentence;
      }
    }
    
    if (currentBlock.trim()) {
      subChunks.push({ text: currentBlock.trim(), type: 'overflow_block' });
    }

    return subChunks;
  }
}

module.exports = new SemanticChunker();
