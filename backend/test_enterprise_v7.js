require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const http = require('http');

// Models
const Contract = require('./src/models/Contract');
const Clause = require('./src/models/Clause');
const Webhook = require('./src/models/Webhook');
const User = require('./src/models/User');

// Services
const { dispatchWebhooks } = require('./src/services/webhookDispatcher');
const { runAdversaryRedTeamForContract } = require('./src/services/agent6Adversary');
const { callLLM } = require('./src/services/aiClient');

// Since runAgent2RiskAnalyst is not exported, we will test the trap detection natively.
const { detectPredatoryTraps } = require('./src/services/classifierService');

async function testEnterpriseV7() {
  console.log('🚀 Starting Enterprise V7 Architecture Test Suite...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  try {
    // We need a dummy user
    let user = await User.findOne({ email: 'v7test@lexguard.com' });
    if (!user) {
      user = await User.create({
        name: 'V7 Test User',
        email: 'v7test@lexguard.com',
        passwordHash: 'dummy_hash_for_testing',
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 1: Enterprise Webhooks (Phase 4)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- 🧪 TEST 1: Enterprise Webhooks ---');
    
    // Spin up a local server to receive the webhook
    const receivedWebhooks = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        receivedWebhooks.push({ headers: req.headers, body: JSON.parse(body) });
        res.writeHead(200);
        res.end('OK');
      });
    });
    
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const webhookUrl = `http://localhost:${port}/webhook`;
    console.log(`📡 Local webhook receiver listening on ${webhookUrl}`);

    const secret = 'super-secret-hmac-key';
    const webhookDoc = await Webhook.create({
      userId: user._id,
      targetUrl: webhookUrl,
      events: ['contract.analyzed'],
      secret: secret,
    });

    const mockContract1 = await Contract.create({
      userId: user._id,
      originalFileName: 'Webhook_Test.pdf',
      contractCategory: 'employment',
      status: 'done',
      overallRiskLevel: 'high',
    });

    // Fire webhook
    await dispatchWebhooks('contract.analyzed', mockContract1._id);
    
    // Wait a moment for HTTP request to process
    await new Promise(r => setTimeout(r, 1000));

    if (receivedWebhooks.length === 1) {
      const wh = receivedWebhooks[0];
      const sig = wh.headers['x-lexguard-signature'];
      if (!sig) throw new Error('HMAC Signature missing!');
      
      const payloadString = JSON.stringify(wh.body);
      const expectedSig = 'sha256=' + crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
      
      if (sig === expectedSig && wh.body.fileName === 'Webhook_Test.pdf') {
        console.log('✅ Webhook Test PASSED! (Payload and HMAC Signature verified)');
      } else {
        throw new Error(`Signature mismatch or bad payload. Got: ${sig}, Expected: ${expectedSig}`);
      }
    } else {
      throw new Error(`Expected 1 webhook to be received, got ${receivedWebhooks.length}`);
    }

    server.close();
    await Webhook.findByIdAndDelete(webhookDoc._id);

    // ─────────────────────────────────────────────────────────────────
    // TEST 2: Cross-Contract Knowledge Graph (Phase 3)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- 🧪 TEST 2: Cross-Contract Knowledge Graph ---');
    const masterContract = await Contract.create({
      userId: user._id,
      originalFileName: 'Master_Services_Agreement.pdf',
      contractCategory: 'other',
      globalContext: { liabilityCap: '$100,000', jurisdiction: 'Delhi' }
    });

    const childContract = await Contract.create({
      userId: user._id,
      parentContractId: masterContract._id,
      originalFileName: 'SOW_1.pdf',
      contractCategory: 'other',
      globalContext: { scope: 'Software Development' }
    });

    // Verify parent linkage
    const childDb = await Contract.findById(childContract._id).populate('parentContractId');
    if (childDb.parentContractId._id.toString() === masterContract._id.toString()) {
      console.log(`✅ Cross-Contract Linkage PASSED! (SOW correctly linked to ${childDb.parentContractId.originalFileName})`);
    } else {
      throw new Error('Parent linkage failed in database.');
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 3: Agent 6 Adversary (Phase 2)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- 🧪 TEST 3: Agent 6 (Adversary Red-Teaming) ---');
    const clause6 = await Clause.create({
      contractId: mockContract1._id,
      segmentIndex: 1,
      rawText: "The employee shall not work for any competitor globally for 5 years after termination.",
      clause_type: 'non_compete',
      risk_level: 'critical',
      suggested_rewrite: "The employee promises to be reasonably fair to the company."
    });

    await runAdversaryRedTeamForContract(mockContract1._id);

    const updatedClause6 = await Clause.findById(clause6._id);
    if (updatedClause6.adversarial_warning && updatedClause6.hardened_rewrite) {
      console.log(`✅ Agent 6 Test PASSED!`);
      console.log(`   Loophole Found: ${updatedClause6.adversarial_warning}`);
      console.log(`   Hardened Rewrite: ${updatedClause6.hardened_rewrite}`);
    } else {
      throw new Error('Agent 6 failed to generate an adversarial warning and hardened rewrite.');
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 4: Deterministic Guardrails (Phase 1 pre-cursor)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- 🧪 TEST 4: Selective Reflection Triggers ---');
    const predatoryText = "The Company reserves the right to terminate this agreement at any time and for convenience, in which case the employee shall not be entitled to payment for any work completed prior to termination.";
    const traps = detectPredatoryTraps(predatoryText);
    
    if (traps.some(t => t.severity === 'high' || t.severity === 'critical')) {
      console.log(`✅ Deterministic Trap Test PASSED! Detected ${traps.length} traps, triggering reflection loop.`);
      console.log(`   Trap details: ${JSON.stringify(traps[0].type)}`);
    } else {
      throw new Error('Failed to detect predatory trap in known adversarial text.');
    }

    console.log('\n🎉 ALL ENTERPRISE V7 TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
}

testEnterpriseV7();
