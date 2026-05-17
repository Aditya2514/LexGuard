const path = require('path');
const { parsePdf } = require('./pdfParser');
const { parseDocx } = require('./docxParser');
const { cleanText } = require('./textCleaner');
const ApiError = require('../utils/ApiError');

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx'];

/**
 * Detects file type by extension and delegates to the correct parser.
 * Returns cleaned raw text as a single string.
 *
 * @param {string} filePath - Absolute path to the uploaded temp file.
 * @param {string} originalName - Original file name (used for extension detection).
 * @returns {Promise<string>} - Cleaned extracted text.
 */
const extractText = async (filePath, originalName) => {
  const ext = path.extname(originalName).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new ApiError(
      400,
      `Unsupported file type "${ext}". Only PDF (.pdf) and Word (.docx) files are accepted.`
    );
  }

  let rawText;

  if (ext === '.pdf') {
    rawText = await parsePdf(filePath);
  } else if (ext === '.docx') {
    rawText = await parseDocx(filePath);
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new ApiError(
      422,
      'Could not extract any text from the uploaded file. ' +
        'The file may be scanned/image-based, password-protected, or empty.'
    );
  }

  return cleanText(rawText);
};

module.exports = { extractText };
