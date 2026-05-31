/** Minimum length (chars) for a segment to be kept as an independent clause. */
const MIN_CLAUSE_LENGTH = 80;

/**
 * Detects if a line looks like a section heading.
 * Matches ALL-CAPS headings or numbered headings like "1. DEFINITIONS".
 * @param {string} text
 * @returns {boolean}
 */
const isHeading = (text) => {
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length < 3) return false;

  // ALL CAPS heading (e.g., "CONFIDENTIALITY", "NON-COMPETE CLAUSE")
  if (firstLine === firstLine.toUpperCase() && /[A-Z]/.test(firstLine)) {
    return true;
  }
  // Numbered heading (e.g., "1. Definitions", "2.1 Scope of Work")
  if (/^\d+(\.\d+)?\s+[A-Z]/.test(firstLine)) {
    return true;
  }
  return false;
};

/**
 * Detects if the current segment is logically a continuation of the previous segment.
 */
function isContinuation(prev, current) {
    const trimmedPrev = prev.trimEnd();
    const trimmedCurrent = current.trimStart();
    // Continuation if previous ends with colon, comma, or semicolon
    if (/[,:;]$/.test(trimmedPrev)) return true;
    // Continuation if current starts with lowercase letter
    if (/^[a-z]/.test(trimmedCurrent)) return true;
    // Continuation if current starts with sub-item markers that are children
    if (/^\([a-z]\)|\([ivx]+\)/i.test(trimmedCurrent) && !isHeading(trimmedCurrent)) return true;
    // Continuation if current is very short (< 80 chars) and not a heading
    if (trimmedCurrent.length < 80 && !isHeading(trimmedCurrent)) return true;
    return false;
}

/**
 * Heuristic-based contract clause splitter. Uses only code — no AI.
 *
 * Strategy:
 *  1. Split on double newlines (paragraph boundaries).
 *  2. Within each paragraph, further split on numbered/lettered sub-items
 *     or ALL-CAPS headings appearing mid-text.
 *  3. Merge orphan segments shorter than MIN_CLAUSE_LENGTH into the previous.
 *  4. Filter out any remaining too-short segments.
 *
 * @param {string} cleanedText - Output from textCleaner.
 * @returns {{ segmentIndex: number, rawText: string }[]}
 */
const splitClauses = (cleanedText) => {
  // Step 1: Split on double newlines
  const paragraphs = cleanedText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Step 2: Further split on numbered/lettered patterns at start of a new line
  const segments = [];
  for (const paragraph of paragraphs) {
    const subParts = paragraph.split(
      /\n(?=\d+\.\s|\d+\.\d+\s|\([a-zA-Z]\)\s|\([ivxIVX]+\)\s)/
    );
    subParts.forEach((part) => {
      const trimmed = part.trim();
      if (trimmed.length > 0) segments.push(trimmed);
    });
  }

  // Step 3: Merge orphan short segments and logical continuations into the previous clause
  const merged = [];
  for (const seg of segments) {
    const prevSeg = merged[merged.length - 1];
    if (prevSeg && isContinuation(prevSeg, seg)) {
      merged[merged.length - 1] += '\n' + seg;
    } else if (merged.length > 0 && seg.length < MIN_CLAUSE_LENGTH && !isHeading(seg)) {
      merged[merged.length - 1] += '\n' + seg;
    } else {
      merged.push(seg);
    }
  }

  // Step 4: Filter, index, and return
  return merged
    .filter((seg) => seg.trim().length >= MIN_CLAUSE_LENGTH)
    .map((rawText, index) => ({ segmentIndex: index, rawText: rawText.trim() }));
};

module.exports = { splitClauses };
