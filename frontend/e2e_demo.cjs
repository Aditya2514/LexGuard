const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const DOCX_PATH = path.join(__dirname, '../backend/test_contract.docx');
const SCREENSHOT_DIR = path.join(__dirname, '../artifacts');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function delay(time) {
  return new Promise(function(resolve) { 
    setTimeout(resolve, time)
  });
}

(async () => {
  console.log('Starting E2E Browser Test...');
  const browser = await puppeteer.launch({ 
    headless: 'new', // Or true
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();

  try {
    // 1. Landing Page
    console.log('Navigating to Landing Page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_landing.png') });

    // 2. Register
    console.log('Navigating to Register...');
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2' });
    
    const email = `demo-e2e-${Date.now()}@example.com`;
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', 'demopass123');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_register.png') });
    
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    // 3. Dashboard
    console.log('On Dashboard...');
    await delay(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_dashboard.png') });

    // 4. Upload Contract
    console.log('Uploading Contract...');
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(DOCX_PATH);
    
    // Select category (if there's a select element)
    const categorySelect = await page.$('select');
    if (categorySelect) {
      await page.select('select', 'employment');
    }
    
    await page.click('button.upload-btn'); // Assuming the upload button has this class or similar
    // We can just click the button with text "Upload & Analyze"
    
    // Wait for the modal or upload process
    await delay(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_uploading.png') });
    
    // Wait for processing to finish and redirect to details page
    // For local test with batched HF, this might take 5-10s
    console.log('Waiting for AI analysis...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await delay(2000); // extra buffer for animations
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_analysis_result.png') });

    // 5. Pricing Page
    console.log('Navigating to Pricing Page...');
    await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'networkidle2' });
    await delay(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_pricing.png') });

    // 6. Click Upgrade to Pro
    console.log('Opening Razorpay Checkout Modal...');
    // Find the button that says "Upgrade to Pro"
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.innerText, btn);
      if (text.includes('Upgrade to Pro')) {
        await btn.click();
        break;
      }
    }
    
    // Wait for the Razorpay iframe
    await delay(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_razorpay_modal.png') });

    console.log('🎉 E2E Test completed successfully!');
  } catch (error) {
    console.error('❌ E2E Test failed:', error);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png') });
  } finally {
    await browser.close();
  }
})();
