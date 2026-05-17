const pdfParse = require('pdf-parse');
const fs = require('fs');

/**
 * Extracts raw text from a PDF file using pdf-parse.
 * @param {string} filePath - Absolute path to the PDF file.
 * @returns {Promise<string>} - Raw extracted text.
 */
const parsePdf = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
};

module.exports = { parsePdf };
