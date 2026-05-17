/**
 * Cleans raw extracted text from PDF/DOCX.
 * Removes page numbers, form feeds, repeated headers, and normalizes whitespace.
 * @param {string} rawText - Raw text from parser.
 * @returns {string} - Cleaned text.
 */
const cleanText = (rawText) => {
  let text = rawText;

  // Replace form feeds (PDF page breaks) with newlines
  text = text.replace(/\f/g, '\n');

  // Remove carriage returns
  text = text.replace(/\r/g, '');

  // Remove "Page X of Y" patterns (case-insensitive)
  text = text.replace(/\b[Pp]age\s+\d+\s+of\s+\d+\b/g, '');

  // Remove "- 1 -" style page numbers on their own line
  text = text.replace(/^[-–]\s*\d+\s*[-–]\s*$/gm, '');

  // Remove standalone digits on their own line (likely page numbers, e.g. "1", "12")
  text = text.replace(/^\s*\d{1,3}\s*$/gm, '');

  // Normalize tabs to single space
  text = text.replace(/\t/g, ' ');

  // Collapse multiple spaces into one
  text = text.replace(/ {2,}/g, ' ');

  // Collapse 3+ consecutive newlines into exactly two
  text = text.replace(/\n{3,}/g, '\n\n');

  // Trim each line
  text = text
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  return text.trim();
};

module.exports = { cleanText };
