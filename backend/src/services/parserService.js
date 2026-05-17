const path = require('path');
const { parsePdf } = require('./pdfParser');
const { parseDocx } = require('./docxParser');
const { cleanText } = require('./textCleaner');
const ApiError = require('../utils/ApiError');

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx'];

/**
 * Detects file type and delegates to the correct parser.
 * Returns cleaned raw text as a single string.
 * Throws ApiError 422 for corrupted/unreadable files.
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

  try {
    if (ext === '.pdf') {
      rawText = await parsePdf(filePath);
    } else if (ext === '.docx') {
      rawText = await parseDocx(filePath);
    }
  } catch (parseErr) {
    // pdf-parse throws errors like "bad XRef entry", "Invalid PDF structure"
    // mammoth throws errors for corrupted/invalid ZIP (DOCX) files
    // Both should be user-facing 422, not server 500
    throw new ApiError(
      422,
      `Could not parse the uploaded file. It may be corrupted, password-protected, or not a valid ${ext.toUpperCase()} file. (${parseErr.message})`
    );
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
