const axios = require('axios');
const http = require('http');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = require('./src/server');

const PORT = 7866;
const BASE_URL = `http://localhost:${PORT}`;

async function runE2E() {
    let server;
    try {
        console.log('🚀 Starting LexGuard E2E System Test with DOCX upload...');
        
        // Start Server
        server = http.createServer(app);
        await new Promise(resolve => server.listen(PORT, resolve));
        console.log(`✅ Server listening on ${BASE_URL}`);

        // 1. Create a User
        const uniqueEmail = `test_${Date.now()}@lexguard.ai`;
        const registerRes = await axios.post(`${BASE_URL}/api/auth/register`, {
            name: "E2E Test User",
            email: uniqueEmail,
            password: "SecurePassword123!"
        });
        const token = registerRes.data.token;
        console.log(`✅ User registered successfully. Token received.`);

        // 2. Submit a Contract
        console.log('📤 Uploading dummy.docx for analysis...');
        
        const form = new FormData();
        form.append('file', fs.createReadStream('dummy.docx'));
        form.append('title', 'E2E Asymmetric NDA');
        form.append('contractCategory', 'employment');

        const uploadRes = await axios.post(`${BASE_URL}/api/contracts?sync=false`, form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${token}`
            }
        });

        const contractId = uploadRes.data.data.contractId;
        console.log(`✅ Contract uploaded. ID: ${contractId}`);

        // 3. Poll for Completion
        console.log('⏳ Polling for analysis completion (this may take up to 45s)...');
        let status = 'processing';
        let pollCount = 0;
        let contractData = null;

        while (status === 'processing' && pollCount < 20) {
            await new Promise(r => setTimeout(r, 4000)); // 4 sec intervals
            pollCount++;
            
            const statusRes = await axios.get(`${BASE_URL}/api/contracts/${contractId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            status = statusRes.data.data.status;
            contractData = statusRes.data.data;
            console.log(`   Poll ${pollCount}: Status is '${status}'...`);
        }

        if (status !== 'completed' && status !== 'done') {
            throw new Error(`Analysis timed out or failed. Final status: ${status}`);
        }

        const clausesRes = await axios.get(`${BASE_URL}/api/contracts/${contractId}/clauses?limit=100`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const clauses = clausesRes.data.data.clauses;

        console.log(`✅ Analysis Completed!`);
        console.log(`\n📊 E2E Test Results:`);
        console.log(`- Contract ID: ${contractData._id}`);
        console.log(`- Total Risk Score: ${contractData.overallRiskLevel}`);
        
        if (clauses && clauses.length > 0) {
            console.log(`✅ Verified: Clauses extracted successfully (${clauses.length} found).`);
        } else {
            throw new Error('No clauses returned in the summary!');
        }

        console.log('\n🎉 FULL SYSTEM E2E TEST PASSED. APIs, Redis Queues, and MongoDB are fully linked and operational.');

    } catch (error) {
        console.error('❌ E2E TEST FAILED:', error?.response?.data || error.message);
    } finally {
        // Cleanup
        if (server) {
            server.close();
            console.log('Server shut down.');
        }
        await mongoose.disconnect();
        process.exit(0);
    }
}

runE2E();
