const mammoth = require('mammoth');

/**
 * Extracts raw text from a DOCX file using mammoth.
 * @param {string} filePath - Absolute path to the DOCX file.
 * @returns {Promise<string>} - Raw extracted text.
 */
const parseDocx = async (filePath) => {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
};

module.exports = { parseDocx };
