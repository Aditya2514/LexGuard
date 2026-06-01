const OCRService = require('../src/services/ocrService');
const fs = require('fs');
const path = require('path');

async function testOCRFallback() {
    console.log('🧪 Testing Phase 7: OCR Worker Pool Fallback\\n');

    try {
        // Create a dummy buffer (usually this would be a scanned PDF)
        const dummyBuffer = Buffer.from('dummy pdf content');
        
        console.log('--- Triggering OCR Service ---');
        // This will trigger the pdf-img-convert local mock, OR run the full pipeline if installed
        const reconstructedText = await OCRService.processPDFBuffer(dummyBuffer);
        
        console.log('\\n✅ Reconstructed Text Output:');
        console.log('--------------------------------------------------');
        console.log(reconstructedText);
        console.log('--------------------------------------------------');
        console.log('\\n🎉 Phase 7 OCR Pipeline Test Complete.');
    } catch (err) {
        console.error('❌ Test failed:', err);
    }
}

testOCRFallback();
