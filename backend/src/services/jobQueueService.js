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
const { runAgent4FinancialAnalyst } = require('./agent4FinancialAnalyst');
const { runAgent5LifecycleExtractor } = require('./agent5LifecycleExtractor');
const { runAdversaryRedTeamForContract } = require('./agent6Adversary');
const { enforceJurisdictionOverrides } = require('./jurisdictionOverrideService');
const { dispatchWebhooks } = require('./webhookDispatcher');
const pLimit = require('p-limit');

const limitFn = typeof pLimit === 'function' ? pLimit : pLimit.default;
const workerLimit = limitFn(3); // Process up to 3 contracts concurrently

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

    // 2. Run Agent 1 (Clause Extraction/Classification) and Embeddings (for RAG)
    await updateJobProgress(contractId, 20, 'Classifying clauses and building RAG index');
    const { embedClausesForContract } = require('./embeddingService');
    await Promise.all([
      classifyClausesForContract(contractId),
      embedClausesForContract(contractId).catch(err => {
        console.error(`⚠️  Non-fatal: Clause embedding failed, skipping RAG index creation: ${err.message}`);
      })
    ]);

    // 3. Run Agent 2 (Risk Analysis), Financial Analyst, and Lifecycle Extractor concurrently
    await updateJobProgress(contractId, 45, 'Analyzing risks and extracting metadata');
    await Promise.all([
      analyseRisksForContract(contractId),
      runAgent4FinancialAnalyst(contractId),
      runAgent5LifecycleExtractor(contractId)
    ]);

    // 4. Run Agent 3 & Compliance Checker Concurrently
    await updateJobProgress(contractId, 70, 'Generating plain-language guides and checking Indian law');
    
    await Promise.all([
      generateUserAdvocateForContract(contractId),
      runComplianceCheckForContract(contractId)
    ]);

    // 5. Finalize overall contract risk rating
    await updateJobProgress(contractId, 85, 'Applying Zero-Trust multi-jurisdiction overrides');
    await enforceJurisdictionOverrides(contractId);

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

    // Asynchronously launch Agent 6 (Adversary Red-Teaming) in the background.
    // This does not block the UI or the job queue completion status.
    runAdversaryRedTeamForContract(contractId).catch(err => {
        console.error(`⚠️ [Agent 6] Background Red-Teaming failed: ${err.message}`);
    });

    // Fire webhook to notify enterprise integrations
    await dispatchWebhooks('contract.analyzed', contractId);

  } catch (err) {
    console.error(`❌ [Queue Worker] Fatal error processing contract ${contractId}:`, err.message);
    
    // Set Job and Contract to failed states
    await updateJobProgress(contractId, 100, 'Analysis failed', 'failed', err.message);
    await Contract.findByIdAndUpdate(contractId, { status: 'failed' });

    // Fire failure webhook
    await dispatchWebhooks('contract.failed', contractId, { error: err.message });
  }
}

/**
 * High-performance reactive worker loop using Redis BRPOP
 */
async function runRedisWorker() {
  console.log('🤖 [Queue Worker] Reactive Redis Queue Worker Started (Concurrency: 3).');
  while (workerActive && safeRedis.isAvailable()) {
    try {
      if (workerLimit.activeCount >= 3) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      const contractId = await safeRedis.brPop(QUEUE_NAME, 2);
      if (contractId) {
        console.log(`🤖 [Queue Worker] Popped contract job: ${contractId} from Redis`);
        
        // Execute concurrently without awaiting the worker thread
        workerLimit(async () => {
          await processContractJob(contractId);
        }).catch(err => console.error(`⚠️ Async worker failed for job ${contractId}:`, err.message));
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

  // Prevent polling if we are already at max concurrency
  if (workerLimit.activeCount >= 3) {
    return;
  }

  try {
    const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const workerId = process.pid.toString();

    // Find the next queued job, or a job that has been locked for too long (crashed worker)
    const nextJob = await QueueJob.findOneAndUpdate(
      {
        $or: [
          { status: 'queued' },
          { status: 'processing', lockedAt: { $lt: new Date(Date.now() - LOCK_TIMEOUT_MS) } }
        ]
      },
      {
        $set: {
          status: 'processing',
          step: 'Acquiring process lock',
          lockedAt: new Date(),
          lockedBy: workerId
        },
        $inc: { attempts: 1 }
      },
      { sort: { createdAt: 1 }, new: true }
    );

    if (nextJob) {
      console.log(`🤖 [Queue Worker ${workerId}] Polled/Locked contract job: ${nextJob.contractId} from MongoDB. Attempt: ${nextJob.attempts}`);
      
      // If a job fails more than 3 times, mark it as failed to prevent poison pills
      if (nextJob.attempts > 3) {
        console.error(`❌ [Queue Worker ${workerId}] Job ${nextJob.contractId} exceeded max attempts. Marking as failed.`);
        await updateJobProgress(nextJob.contractId, 100, 'Analysis failed (Max attempts exceeded)', 'failed');
        await Contract.findByIdAndUpdate(nextJob.contractId, { status: 'failed' });
        return;
      }

      workerLimit(async () => {
        await processContractJob(nextJob.contractId);
        
        // Unlock job upon successful or handled failure completion
        await QueueJob.findByIdAndUpdate(nextJob._id, {
          $set: { lockedAt: null, lockedBy: null }
        });
      }).catch(err => console.error(`⚠️ Async Mongo worker failed for job ${nextJob.contractId}:`, err.message));
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
