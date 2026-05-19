const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Minimum character threshold below which we consider the PDF to be scanned/image-based
 * and trigger the OCR fallback pipeline.
 */
const LOW_TEXT_DENSITY_THRESHOLD = 100;

/**
 * Check if Tesseract OCR is available on the system PATH.
 * @returns {Promise<boolean>}
 */
function isTesseractAvailable() {
  return new Promise((resolve) => {
    exec('tesseract --version', (err) => {
      resolve(!err);
    });
  });
}

/**
 * Run Tesseract OCR on a single image file and return extracted text.
 * @param {string} imagePath - Absolute path to the image file.
 * @returns {Promise<string>} - OCR-extracted text.
 */
function runTesseractOnImage(imagePath) {
  return new Promise((resolve, reject) => {
    const outputBase = imagePath + '_ocr';
    exec(
      `tesseract "${imagePath}" "${outputBase}" -l eng --psm 6`,
      { timeout: 60000 },
      (err) => {
        const outputFile = outputBase + '.txt';
        if (err) {
          // Clean up any partial output
          if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
          return reject(new Error(`Tesseract OCR failed: ${err.message}`));
        }
        if (!fs.existsSync(outputFile)) {
          return reject(new Error('Tesseract produced no output file.'));
        }
        const text = fs.readFileSync(outputFile, 'utf-8');
        fs.unlinkSync(outputFile); // Clean up temp OCR output
        resolve(text);
      }
    );
  });
}

/**
 * Attempts OCR extraction on a PDF by converting pages to images first.
 * Uses pdftoppm (from poppler-utils) to rasterize, then Tesseract to OCR.
 * 
 * @param {string} pdfPath - Absolute path to the scanned PDF.
 * @returns {Promise<string>} - OCR-extracted full text.
 */
async function ocrFallbackForPdf(pdfPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexguard-ocr-'));

  try {
    // Step 1: Convert PDF pages to PNG images using pdftoppm (poppler-utils)
    const outputPrefix = path.join(tmpDir, 'page');
    await new Promise((resolve, reject) => {
      exec(
        `pdftoppm -png -r 300 "${pdfPath}" "${outputPrefix}"`,
        { timeout: 120000 },
        (err) => {
          if (err) return reject(new Error(`PDF-to-image conversion failed: ${err.message}`));
          resolve();
        }
      );
    });

    // Step 2: Collect all generated page images, sorted by name
    const pageImages = fs.readdirSync(tmpDir)
      .filter(f => f.endsWith('.png'))
      .sort()
      .map(f => path.join(tmpDir, f));

    if (pageImages.length === 0) {
      throw new Error('No page images generated from scanned PDF.');
    }

    console.log(`📄 OCR Fallback: Processing ${pageImages.length} page(s) through Tesseract...`);

    // Step 3: Run Tesseract on each page image sequentially
    const pageTexts = [];
    for (const imgPath of pageImages) {
      const pageText = await runTesseractOnImage(imgPath);
      pageTexts.push(pageText);
    }

    return pageTexts.join('\n\n');
  } finally {
    // Cleanup: remove all temp files
    try {
      const files = fs.readdirSync(tmpDir);
      for (const f of files) {
        fs.unlinkSync(path.join(tmpDir, f));
      }
      fs.rmdirSync(tmpDir);
    } catch (_) {
      // Best-effort cleanup
    }
  }
}

module.exports = {
  LOW_TEXT_DENSITY_THRESHOLD,
  isTesseractAvailable,
  ocrFallbackForPdf,
};
