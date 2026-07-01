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

    // Fix concatenated sentences with missing spaces (e.g. "50,00,000.Milestone" -> "50,00,000. Milestone")
    // Only matches when the capital letter starts a real word (followed by a lowercase letter),
    // not abbreviations like "U.S.A." or "Pvt.Ltd." where the next char after capital is also capital or a period.
    clean = clean.replace(/\.([A-Z][a-z])/g, '. $1');

    return clean;
  }

  isHeader(text) {
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 120) return false;
    
    // Check for standard section patterns
    const headingPatterns = [
      /^\d+(\.\d+)*\.?\s+[A-Za-z0-9\s&/,()’'-]+$/i,
      /^(Article|Section|Clause|Schedule|Exhibit)\s+\d+.*$/i,
      /^[A-Z0-9\s&/,()’'-]+$/ // All uppercase (common heading)
    ];

    const hasSentencePunctuation = /[.!?]$/.test(trimmed);
    
    if (trimmed.length < 80) {
      if (!hasSentencePunctuation) return true;
      for (const regex of headingPatterns) {
        if (regex.test(trimmed)) return true;
      }
    }
    return false;
  }

  /**
   * The Two-Pass Chunking Algorithm
   */
  chunkDocument(rawText) {
    const normalizedText = this.normalizeText(rawText);

    // PASS 1: Heuristic Split (Split by double newlines or forced section breaks)
    const initialChunks = normalizedText.split(/\n{2,}/);
    
    // Post-split pass: Merge headers/headings with their subsequent blocks to prevent fragmentation
    const mergedInitialChunks = [];
    let pendingHeader = "";
    
    for (const chunk of initialChunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      
      if (this.isHeader(trimmed)) {
        if (pendingHeader) {
          pendingHeader += "\n\n" + trimmed;
        } else {
          pendingHeader = trimmed;
        }
      } else {
        if (pendingHeader) {
          mergedInitialChunks.push(pendingHeader + "\n\n" + trimmed);
          pendingHeader = "";
        } else {
          mergedInitialChunks.push(trimmed);
        }
      }
    }
    
    if (pendingHeader) {
      mergedInitialChunks.push(pendingHeader);
    }

    const finalChunks = [];

    // PASS 2: Token Overflow Protection
    // If a chunk is still too massive (e.g., a 4-page schedule), recursively split it by paragraphs or sentences
    for (const chunk of mergedInitialChunks) {
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
    // Split by sentence-ending punctuation using lookbehind to protect decimals
    const sentences = massiveChunk.split(/(?<=[.!?])\s+/);
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
