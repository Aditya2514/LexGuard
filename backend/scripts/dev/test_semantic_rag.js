const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { retrieveRelevantLaws } = require('./src/services/lawRetrieverService');
const LawSection = require('./src/models/LawSection');

async function runTestSemanticRAG() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in environment.');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected successfully!');

  console.log('\n======================================================');
  console.log('    LexGuard SEMANTIC EMBEDDING COSINE RAG TEST SUITE ');
  console.log('======================================================\n');

  try {
    // -------------------------------------------------------------------------
    console.log('🧠 TEST 1: Paraphrased Restraint of Trade Clause (Section 27)');
    // Original clause is "not work or compete post-termination"
    // We use a heavily paraphrased clause with zero literal word matches:
    const paraphrasedA = 'Upon termination, the executive is strictly prohibited from engaging in any commercial activities that compete directly or indirectly with the firm within the territory of India.';
    
    console.log(`  Query: "${paraphrasedA}"`);
    const resultsA = await retrieveRelevantLaws(paraphrasedA, 'non_compete');

    console.log(`  Retrieved Matches: ${resultsA.length}`);
    resultsA.forEach((r, idx) => {
      console.log(`    [Match ${idx + 1}] ${r.actName} - ${r.sectionNumber}`);
      console.log(`      Title: ${r.title}`);
    });

    if (resultsA.length > 0 && resultsA[0].sectionNumber === 'Section 27') {
      console.log('  ✅ TEST 1 PASSED: Successfully retrieved Section 27 (Restraint of Trade) via semantic vector matching!');
    } else {
      console.error('  ❌ TEST 1 FAILED: Could not match Section 27 semantically.');
    }

    // -------------------------------------------------------------------------
    console.log('\n🧠 TEST 2: Paraphrased Arbitration Unilateral Appointment Clause');
    const paraphrasedB = 'In case of disputes, a neutral arbitrator will be handpicked solely by the employer without consulting the employee.';
    
    console.log(`  Query: "${paraphrasedB}"`);
    const resultsB = await retrieveRelevantLaws(paraphrasedB, 'arbitration');

    console.log(`  Retrieved Matches: ${resultsB.length}`);
    resultsB.forEach((r, idx) => {
      console.log(`    [Match ${idx + 1}] ${r.actName} - ${r.sectionNumber}`);
      console.log(`      Title: ${r.title}`);
    });

    if (resultsB.length > 0 && resultsB[0].actKey === 'ARBITRATION_ACT') {
      console.log('  ✅ TEST 2 PASSED: Successfully retrieved Arbitration Act references via semantic similarity!');
    } else {
      console.error('  ❌ TEST 2 FAILED: Could not match Arbitration Act references.');
    }

    // -------------------------------------------------------------------------
    console.log('\n🧠 TEST 3: Caching & Lazy-Evaluation Check');
    const secBefore = await LawSection.findOne({ sectionNumber: 'Section 27' });
    if (secBefore && secBefore.embedding && secBefore.embedding.length > 0) {
      console.log(`  ✅ TEST 3 PASSED: Lazy embedding is correctly populated and saved in database (${secBefore.embedding.length} dimensions).`);
    } else {
      console.error('  ❌ TEST 3 FAILED: Embedding field is empty or missing in DB.');
    }

  } catch (err) {
    console.error('❌ Semantic RAG test suite crashed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\n🟢 Semantic RAG test suite completed.');
  }
}

runTestSemanticRAG();
