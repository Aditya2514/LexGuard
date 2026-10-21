const fs = require('fs');
const path = require('path');


const API_URL = 'http://localhost:5001/api';

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, options);
  
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await res.json();
    return { status: res.status, data };
  } else {
    const text = await res.text();
    return { status: res.status, data: text };
  }
}

async function runTest() {
  console.log('--- STARTING LEXGUARD API WORKFLOW TEST ---');
  let token = null;
  let contractId = null;

  try {
    // 1. Register / Login
    console.log('[1/4] Registering test user...');
    const email = `testuser_${Date.now()}@example.com`;
    let res = await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'testpassword123' })
    });
    
    if (res.status !== 201 && res.status !== 200) {
      throw new Error('Registration failed: ' + JSON.stringify(res.data));
    }
    token = res.data.token;
    console.log(`✅ Registered successfully. Token: ${token.substring(0, 10)}...`);

    // 2. Create Dummy PDF and Upload
    console.log('[2/4] Uploading dummy contract...');
    const dummyPath = path.join(__dirname, 'dummy_contract.pdf');
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(dummyPath));
    doc.text('This is a highly confidential NDA. The employee shall not disclose any trade secrets. Penalty for breach is 1 million dollars.');
    doc.end();

    await new Promise(resolve => setTimeout(resolve, 500)); // wait for file write
    
    // We append ?sync=true to avoid waiting for the async job queue for this simple test
    const fileBuffer = fs.readFileSync(dummyPath);
    const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
    
    const form = new FormData();
    form.append('file', fileBlob, 'dummy_contract.pdf');
    form.append('contractCategory', 'other');
    
    res = await request('/contracts?sync=true', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`
      },
      body: form
    });
    
    fs.unlinkSync(dummyPath);

    if (res.status !== 201 && res.status !== 202) {
      throw new Error('Upload failed: ' + JSON.stringify(res.data));
    }
    contractId = res.data.data.contractId;
    console.log(`✅ Uploaded successfully. Contract ID: ${contractId}`);
    console.log(`   Status: ${res.data.data.status}`);

    // Wait a bit just in case
    await new Promise(r => setTimeout(r, 2000));

    // 3. Fetch Contract Details & Analytics
    console.log('[3/4] Fetching contract details & clauses...');
    const detailRes = await request(`/contracts/${contractId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (detailRes.status !== 200) throw new Error('Fetch details failed');

    const clauseRes = await request(`/contracts/${contractId}/clauses-detailed?limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (clauseRes.status !== 200) throw new Error('Fetch clauses failed');
    
    const summaryRes = await request(`/contracts/${contractId}/risk-summary`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (summaryRes.status !== 200) throw new Error('Fetch summary failed');

    console.log(`✅ Fetched details successfully. Found ${clauseRes.data.data.total} clauses.`);

    // 4. Test Chat (Agent 5)
    console.log('[4/4] Testing Contract Chat (Agent 5)...');
    const chatRes = await request(`/contracts/${contractId}/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ message: 'What is this contract about?' })
    });

    if (chatRes.status !== 200) {
      throw new Error('Chat failed: ' + JSON.stringify(chatRes.data));
    }
    console.log(`✅ Chat responded: ${chatRes.data.data.reply.substring(0, 50)}...`);

    console.log('--- ALL TESTS PASSED SUCCESSFULLY ---');

  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTest();
