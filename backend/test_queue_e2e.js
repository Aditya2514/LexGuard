const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Contract = require('./src/models/Contract');
const Clause = require('./src/models/Clause');
const QueueJob = require('./src/models/QueueJob');
const jobQueueService = require('./src/services/jobQueueService');
const safeRedis = require('./src/config/redisClient');

async function runTestQueueE2E() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in environment.');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected successfully!');

  // Start background worker
  console.log('🤖 Starting job queue worker daemon...');
  jobQueueService.startQueueWorker();

  console.log('\n======================================================');
  console.log('      LexGuard ASYNC JOB QUEUE E2E TEST SUITE        ');
  console.log('======================================================\n');

  let contract = null;
  try {
    // 1. Create a mock contract
    console.log('📝 1. Creating mock contract...');
    contract = await Contract.create({
      originalFileName: 'E2E_Async_Queue_Test_Contract.pdf',
      contractCategory: 'employment',
      rawText: 'This is a test contract for testing the asynchronous background queue.',
      status: 'processing',
    });
    console.log(`   Created contract with ID: ${contract._id}`);

    // 2. Insert test clauses (including a predatory training bond and a non-compete)
    console.log('📝 2. Inserting adversarial clauses for multi-agent pipeline...');
    const testClauses = [
      {
        contractId: contract._id,
        segmentIndex: 0,
        rawText: 'Clause 1: The Employee shall not, for a period of two years after termination of employment, work or compete in India.',
      },
      {
        contractId: contract._id,
        segmentIndex: 1,
        rawText: 'Clause 2: The Employee agrees to serve for 36 months. In case of early resignation, the employee must repay a training bond of $450 in compounding interest admin fees.',
      }
    ];
    await Clause.insertMany(testClauses);
    console.log('   Clauses bulk-inserted.');

    // 3. Enqueue the contract job
    console.log('📦 3. Enqueuing contract job...');
    await jobQueueService.enqueueJob(contract._id);

    // 4. Poll QueueJob to verify progress and transitions
    console.log('⏳ 4. Polling QueueJob progress from database...');
    let jobCompleted = false;
    
    // Poll up to 45 seconds (plenty of time for Hugging Face or Gemini to respond)
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      
      const job = await QueueJob.findOne({ contractId: contract._id });
      if (!job) {
        console.log('   Waiting for job registration...');
        continue;
      }

      console.log(`   [Poll #${i + 1}] Status: "${job.status}" | Progress: ${job.progress}% | Step: "${job.step}"`);

      if (job.status === 'completed') {
        jobCompleted = true;
        break;
      }
      if (job.status === 'failed') {
        throw new Error(`Background job failed: ${job.error}`);
      }
    }

    if (!jobCompleted) {
      throw new Error('E2E Queue Test Timed out after 45 seconds.');
    }

    console.log('\n✅ 5. Verifying database analysis persistence...');
    
    // Check contract status
    const updatedContract = await Contract.findById(contract._id);
    console.log(`   Contract Status: "${updatedContract.status}" (Expected: "done")`);
    console.log(`   Overall Risk Level: "${updatedContract.overallRiskLevel}" (Expected: "high" or "critical")`);

    if (updatedContract.status !== 'done') {
      throw new Error(`Contract status is ${updatedContract.status}, expected "done"`);
    }

    // Check processed clauses
    const processedClauses = await Clause.find({ contractId: contract._id }).sort({ segmentIndex: 1 });
    processedClauses.forEach((c, idx) => {
      console.log(`\n   --- Clause #${idx + 1} ---`);
      console.log(`   Categorised Type: "${c.clause_type}"`);
      console.log(`   Risk Level: "${c.risk_level}"`);
      console.log(`   Compliance Risk: "${c.compliance_risk_level}"`);
      console.log(`   Plain Guide Explanation: "${c.plain_language_explanation?.substring(0, 80)}..."`);
    });

    console.log('\n🎉 E2E ASYNC JOB QUEUE TEST SUITE FULLY PASSED!');

  } catch (err) {
    console.error('\n❌ E2E Queue Test Suite failed:', err.message);
  } finally {
    // Cleanup mock data
    if (contract) {
      console.log('\n🧹 Cleaning up E2E mock contract database records...');
      await Clause.deleteMany({ contractId: contract._id });
      await Contract.findByIdAndDelete(contract._id);
      await QueueJob.deleteMany({ contractId: contract._id });
      console.log('   Mock data cleaned.');
    }

    // Stop workers cleanly
    jobQueueService.stopQueueWorker();
    
    // Close redis
    await safeRedis.quit();
    
    await mongoose.disconnect();
    console.log('🟢 E2E Queue test suite run completed.');
  }
}

runTestQueueE2E();
