const mongoose = require('mongoose');
const path = require('path');
const { Readable } = require('stream');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Contract = require('../src/models/Contract');
const Clause = require('../src/models/Clause');
const QueueJob = require('../src/models/QueueJob');
const embeddingService = require('../src/services/embeddingService');

// Mock HuggingFace API for stress testing to avoid real HTTP network bottleneck limits
embeddingService.generateEmbedding = async (text) => {
  return Array.from({ length: 384 }, () => Math.random());
};

async function runStressTest() {
  console.log('🚀 Starting Zero-Rupee Architecture Stress Test...\n');
  
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('✅ Connected to MongoDB\n');

  const results = {
    gridFsStress: null,
    queueLockStress: null,
    ragStress: null
  };

  try {
    // ---------------------------------------------------------
    // 1. GridFS Stress Test
    // ---------------------------------------------------------
    console.log('--- 1. GridFS Concurrent Upload Stress ---');
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'contracts' });
    const t0 = performance.now();
    
    // Create 20 concurrent file uploads
    const uploadPromises = Array.from({ length: 20 }).map((_, i) => {
      return new Promise((resolve, reject) => {
        const dummyPdfContent = Buffer.from(`%PDF-1.4 Mock PDF Content ${i}`.repeat(1000));
        const readable = new Readable();
        readable.push(dummyPdfContent);
        readable.push(null);

        const uploadStream = bucket.openUploadStream(`stress_test_file_${i}.pdf`);
        readable.pipe(uploadStream)
          .on('error', reject)
          .on('finish', () => resolve(uploadStream.id));
      });
    });

    const fileIds = await Promise.all(uploadPromises);
    const t1 = performance.now();
    console.log(`✅ Uploaded 20 files to GridFS in ${(t1 - t0).toFixed(2)}ms`);
    results.gridFsStress = `Passed: 20 concurrent uploads in ${(t1 - t0).toFixed(2)}ms`;

    // Cleanup GridFS
    await Promise.all(fileIds.map(id => bucket.delete(id).catch(() => {})));

    // ---------------------------------------------------------
    // 2. Queue Lock Stress Test
    // ---------------------------------------------------------
    console.log('\n--- 2. Atomic Queue Lock Stress (Concurrency) ---');
    const mockContractId = new mongoose.Types.ObjectId();
    
    // Insert 50 jobs
    const jobsToInsert = Array.from({ length: 50 }).map(() => ({
      contractId: mockContractId,
      status: 'queued'
    }));
    await QueueJob.insertMany(jobsToInsert);

    const t2 = performance.now();
    let processedCount = 0;
    const workerIds = ['Worker-A', 'Worker-B', 'Worker-C', 'Worker-D', 'Worker-E'];

    // Simulate 5 workers aggressively polling at the exact same time
    const workerPromises = workerIds.map(async (workerId) => {
      let active = true;
      let localCount = 0;
      while (active) {
        const job = await QueueJob.findOneAndUpdate(
          { status: 'queued' },
          { $set: { status: 'processing', lockedAt: new Date(), lockedBy: workerId } },
          { sort: { createdAt: 1 }, new: true }
        );
        if (job) {
          localCount++;
          // simulate minimal work
          await new Promise(r => setTimeout(r, 10)); 
          await QueueJob.findByIdAndUpdate(job._id, { status: 'done', lockedAt: null, lockedBy: null });
        } else {
          active = false;
        }
      }
      return { workerId, count: localCount };
    });

    const workerStats = await Promise.all(workerPromises);
    const t3 = performance.now();
    processedCount = workerStats.reduce((acc, w) => acc + w.count, 0);
    
    console.log(`✅ Processed ${processedCount} jobs across 5 concurrent workers in ${(t3 - t2).toFixed(2)}ms`);
    workerStats.forEach(w => console.log(`   - ${w.workerId} processed ${w.count} jobs`));
    
    if (processedCount === 50) {
      results.queueLockStress = `Passed: 50 jobs locked cleanly by 5 workers in ${(t3 - t2).toFixed(2)}ms`;
    } else {
      results.queueLockStress = `Failed: Data race occurred, processed ${processedCount}/50`;
    }

    // ---------------------------------------------------------
    // 3. Vector RAG Cosine Similarity Stress Test
    // ---------------------------------------------------------
    console.log('\n--- 3. Vector RAG Search Stress (Memory CPU) ---');
    
    // Create 200 mock clauses (simulating a 100-page document)
    console.log('Generating 200 clauses with 384-dimensional vectors...');
    const massiveClauses = Array.from({ length: 200 }).map((_, i) => ({
      contractId: mockContractId,
      segmentIndex: i,
      rawText: `Clause ${i} containing some legal terminology about indemnification.`,
      embedding: Array.from({ length: 384 }, () => Math.random()) // Random 384d vector
    }));
    await Clause.insertMany(massiveClauses);

    const t4 = performance.now();
    console.log('Executing 20 concurrent semantic RAG queries across 200 clauses...');
    
    const ragPromises = Array.from({ length: 20 }).map(() => 
      embeddingService.searchSimilarClauses(mockContractId, 'Find clauses related to indemnity', 5)
    );
    
    await Promise.all(ragPromises);
    const t5 = performance.now();
    console.log(`✅ Completed 20 concurrent vector searches in ${(t5 - t4).toFixed(2)}ms`);
    results.ragStress = `Passed: 20 concurrent queries over 200 clauses in ${(t5 - t4).toFixed(2)}ms`;

  } catch (error) {
    console.error('❌ Stress Test Error:', error);
  } finally {
    // Cleanup
    await Clause.deleteMany({ contractId: { $exists: false } }); 
    await QueueJob.deleteMany({ status: 'done' });
    await mongoose.connection.close();
    
    console.log('\n📊 --- Stress Test Summary ---');
    console.table(results);
    process.exit(0);
  }
}

runStressTest();
