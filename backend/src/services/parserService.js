const path = require('path');
const fs = require('fs');
const os = require('os');
const { parsePdf } = require('./pdfParser');
const { parseDocx } = require('./docxParser');
const { cleanText } = require('./textCleaner');
const {
  LOW_TEXT_DENSITY_THRESHOLD,
  isTesseractAvailable,
  ocrFallbackForPdf,
} = require('./ocrFallbackService');
const ApiError = require('../utils/ApiError');
const { getFileStream } = require('./gridFsStorage');

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx'];

/**
 * Detects file type and delegates to the correct parser.
 * Reads the file from GridFS, writes to an ephemeral tmp file, and extracts text.
 * Returns cleaned raw text as a single string.
 * Throws ApiError 422 for corrupted/unreadable files.
 */
const extractText = async (fileId, originalName) => {
  const ext = path.extname(originalName).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new ApiError(
      400,
      `Unsupported file type "${ext}". Only PDF (.pdf) and Word (.docx) files are accepted.`
    );
  }

  let rawText;
  
  // Create a temporary file path
  const tmpFilePath = path.join(os.tmpdir(), `lexguard-${Date.now()}-${originalName}`);

  try {
    // Stream file from GridFS to local tmp storage for parsing
    await new Promise((resolve, reject) => {
      const readStream = getFileStream(fileId);
      const writeStream = fs.createWriteStream(tmpFilePath);
      readStream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      readStream.on('error', reject);
    });

    if (ext === '.pdf') {
      try {
        const { parseWithLlama } = require('./llamaParseService');
        console.log('📄 Attempting LlamaParse extraction...');
        rawText = await parseWithLlama(tmpFilePath);
        if (rawText && rawText.trim().length > 0) {
          console.log(`✅ LlamaParse extraction successful.`);
        } else {
          throw new Error('LlamaParse returned empty text');
        }
      } catch (llamaErr) {
        console.warn(`⚠️ LlamaParse failed or not configured (${llamaErr.message}). Falling back to pdf-parse...`);
        rawText = await parsePdf(tmpFilePath);
      }
    } else if (ext === '.docx') {
      rawText = await parseDocx(tmpFilePath);
    }
  } catch (parseErr) {
    throw new ApiError(
      422,
      `Could not parse the uploaded file. It may be corrupted, password-protected, or not a valid ${ext.toUpperCase()} file. (${parseErr.message})`
    );
  }

  // ── OCR Fallback for Scanned PDFs ─────────────────────────────────────────
  if (ext === '.pdf' && (!rawText || rawText.trim().length < LOW_TEXT_DENSITY_THRESHOLD)) {
    console.log(`⚠️  Low text density detected (${(rawText || '').trim().length} chars). Checking for OCR fallback...`);

    const tesseractReady = await isTesseractAvailable();
    if (tesseractReady) {
      try {
        console.log('📄 Scanned PDF detected. Initializing Tesseract OCR pipeline...');
        rawText = await ocrFallbackForPdf(tmpFilePath);
        console.log(`✅ OCR extraction complete. Recovered ${rawText.trim().length} characters.`);
      } catch (ocrErr) {
        console.error(`❌ OCR fallback failed: ${ocrErr.message}`);
        throw new ApiError(
          422,
          'The uploaded PDF appears to be scanned/image-based. ' +
            'OCR extraction was attempted but failed. Please upload a text-based PDF or DOCX file instead. ' +
            `(${ocrErr.message})`
        );
      }
    } else {
      throw new ApiError(
        422,
        'Could not extract text from the uploaded PDF. The file appears to be scanned or image-based. ' +
          'OCR processing is not available on this server. Please upload a text-based PDF or DOCX file instead.'
      );
    }
  }

  // Cleanup temporary file to keep backend stateless
  if (fs.existsSync(tmpFilePath)) {
    fs.unlinkSync(tmpFilePath);
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
