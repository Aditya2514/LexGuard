const QueueJob = require('../models/QueueJob');
const Contract = require('../models/Contract');
const Clause = require('../models/Clause');
const safeRedis = require('../config/redisClient');

// Import Agent Orchestration pipelines
const { extractGlobalContextForContract } = require('./agentPreFlight');
const { classifyClausesForContract } = require('./agent1ClauseExtractor');
const { analyseRisksForContract } = require('./agent2RiskAnalyst');
const { generateUserAdvocateForContract } = require('./agent3UserAdvocate');
const { runComplianceCheckForContract } = require('./agent4ComplianceChecker');

const QUEUE_NAME = 'lexguard:queue';
let workerActive = false;
let workerIntervalId = null;

/**
 * Update both QueueJob progress and metadata step status
 */
async function updateJobProgress(contractId, progress, step, status = 'processing', error = null) {
  try {
    await QueueJob.findOneAndUpdate(
      { contractId },
      { progress, step, status, ...(error && { error }) },
      { upsert: true, new: true }
    );
    
    // In Redis mode, we can publish the progress real-time
    if (safeRedis.isAvailable()) {
      // (Optional) Publish updates for pub/sub to WebSockets
    }
  } catch (err) {
    console.error(`⚠️  Failed to update job progress for ${contractId}:`, err.message);
  }
}

/**
 * Execute all 4 agents in sequential order, managing progress thresholds
 */
async function processContractJob(contractId) {
  console.log(`🚀 [Queue Worker] Starting analysis workflow for contract: ${contractId}`);
  
  try {
    // 1. Initial State
    await updateJobProgress(contractId, 5, 'Initializing agents and extracting global context');
    await extractGlobalContextForContract(contractId);

    // 2. Run Agent 1 (Clause Extraction/Classification)
    await updateJobProgress(contractId, 20, 'Classifying contract clauses (Agent 1: Classifier)');
    await classifyClausesForContract(contractId);

    // 3. Run Agent 2 (Risk Analysis)
    await updateJobProgress(contractId, 45, 'Analyzing risks and statutory touchpoints (Agent 2: Risk Analyst)');
    await analyseRisksForContract(contractId);

    // 4. Run Agent 3 & Agent 4 Concurrently
    await updateJobProgress(contractId, 70, 'Generating plain-language guides and checking Indian law compliance (Agent 3 & 4)');
    await Promise.all([
      generateUserAdvocateForContract(contractId),
      runComplianceCheckForContract(contractId),
    ]);

    // 5. Finalize overall contract risk rating
    await updateJobProgress(contractId, 90, 'Computing final risk score and compiling dashboard');
    
    const analyzedClauses = await Clause.find({ contractId }).select('risk_level');
    const riskLevels = analyzedClauses.map(c => c.risk_level).filter(Boolean);
    let computedOverallRisk = null;
    if (riskLevels.length > 0) {
      const RISK_PRIORITY = { critical: 4, high: 3, medium: 2, low: 1 };
      computedOverallRisk = riskLevels.reduce((worst, lvl) =>
        (RISK_PRIORITY[lvl] || 0) > (RISK_PRIORITY[worst] || 0) ? lvl : worst
      , riskLevels[0]);
    }

    // Update Contract model to complete state
    await Contract.findByIdAndUpdate(contractId, {
      status: 'done',
      ...(computedOverallRisk && { overallRiskLevel: computedOverallRisk }),
    });

    // Mark job as completed
    await updateJobProgress(contractId, 100, 'Analysis complete', 'completed');
    console.log(`🎉 [Queue Worker] Successfully processed contract: ${contractId}`);

  } catch (err) {
    console.error(`❌ [Queue Worker] Fatal error processing contract ${contractId}:`, err.message);
    
    // Set Job and Contract to failed states
    await updateJobProgress(contractId, 100, 'Analysis failed', 'failed', err.message);
    await Contract.findByIdAndUpdate(contractId, { status: 'failed' });
  }
}

/**
 * High-performance reactive worker loop using Redis BRPOP
 */
async function runRedisWorker() {
  console.log('🤖 [Queue Worker] Reactive Redis Queue Worker Started.');
  while (workerActive && safeRedis.isAvailable()) {
    try {
      const contractId = await safeRedis.brPop(QUEUE_NAME, 2);
      if (contractId) {
        console.log(`🤖 [Queue Worker] Popped contract job: ${contractId} from Redis`);
        await processContractJob(contractId);
      }
    } catch (err) {
      console.error('⚠️  Redis worker encountered polling error:', err.message);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  console.log('🔌 [Queue Worker] Redis Queue Worker Stopped.');
  
  // If we deactivated because Redis went down but worker should remain active, fallback
  if (workerActive && !safeRedis.isAvailable()) {
    console.log('⚠️  Redis unavailable, transitioning worker to MongoDB polling mode...');
    startMongoWorker();
  }
}

/**
 * Resilient polling worker using MongoDB QueueJob schema
 */
async function runMongoWorkerPoll() {
  if (!workerActive) return;
  
  // If Redis becomes available again, transition to Redis worker
  if (safeRedis.isAvailable()) {
    console.log('🔌 Redis is back online! Transitioning worker to high-performance Redis mode...');
    clearInterval(workerIntervalId);
    runRedisWorker();
    return;
  }

  try {
    // Find the next queued job
    const nextJob = await QueueJob.findOne({ status: 'queued' }).sort({ createdAt: 1 });
    if (nextJob) {
      console.log(`🤖 [Queue Worker] Polled contract job: ${nextJob.contractId} from MongoDB`);
      // Optimistic lock: set state to processing
      nextJob.status = 'processing';
      nextJob.step = 'Acquiring process lock';
      await nextJob.save();

      await processContractJob(nextJob.contractId);
    }
  } catch (err) {
    console.error('❌ [Queue Worker] MongoDB worker polling failed:', err.message);
  }
}

function startMongoWorker() {
  if (workerIntervalId) clearInterval(workerIntervalId);
  console.log('🤖 [Queue Worker] MongoDB Polling Worker Started (2s interval).');
  workerIntervalId = setInterval(runMongoWorkerPoll, 2000);
}

/**
 * Public Interface
 */
const jobQueueService = {
  /**
   * Add a contract analysis job to the active queue
   */
  enqueueJob: async (contractId) => {
    const cidStr = contractId.toString();
    console.log(`📦 Enqueuing contract job: ${cidStr}`);
    
    // Always initialize/upsert the Job state in MongoDB first
    await QueueJob.findOneAndUpdate(
      { contractId },
      { status: 'queued', progress: 0, step: 'Job Enqueued', error: null },
      { upsert: true, new: true }
    );

    // Try Redis enqueue
    if (safeRedis.isAvailable()) {
      const ok = await safeRedis.lPush(QUEUE_NAME, cidStr);
      if (ok) {
        console.log(`✅ [Queue] Job ${cidStr} enqueued into Redis successfully.`);
        return;
      }
      console.warn('⚠️  Redis lPush failed, falling back to MongoDB enqueuing.');
    }

    // Default: MongoDB enqueuing (already initialized in database, polling worker will pick it up)
    console.log(`✅ [Queue] Job ${cidStr} registered in MongoDB Queue fallback.`);
  },

  /**
   * Start the background worker daemon
   */
  startQueueWorker: () => {
    if (workerActive) return;
    workerActive = true;

    // Wait a brief second to let initial Redis connection settle
    setTimeout(() => {
      if (safeRedis.isAvailable()) {
        runRedisWorker();
      } else {
        startMongoWorker();
      }
    }, 1000);
  },

  /**
   * Stop the background worker cleanly
   */
  stopQueueWorker: () => {
    console.log('🔌 Shutting down LexGuard Queue Worker...');
    workerActive = false;
    if (workerIntervalId) {
      clearInterval(workerIntervalId);
      workerIntervalId = null;
    }
  },

  /**
   * Process a single contract job directly (synchronous routing helper)
   */
  processContractJob: processContractJob
};

module.exports = jobQueueService;
