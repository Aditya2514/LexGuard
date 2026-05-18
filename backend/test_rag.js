const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { retrieveRelevantLaws } = require('./src/services/lawRetrieverService');

async function runTestRAG() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in environment.');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected successfully!');

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   LexGuard RAG Retrieval & Fail-Safe Test Suite      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {
    // ═════════════════════════════════════════════════════════════════════════
    console.log('⚖️  TEST 1: Dynamic MongoDB Full-Text Retrieval (Non-Compete)');
    const clauseA = 'The Employee shall not, for a period of two years after termination of employment, work or compete in India.';
    const resultsA = await retrieveRelevantLaws(clauseA, 'non_compete');

    console.log(`  Clause: "${clauseA}"`);
    console.log(`  Retrieved Matches: ${resultsA.length}`);
    resultsA.forEach((r, idx) => {
      console.log(`    [Match ${idx + 1}] ${r.actName} - ${r.sectionNumber}`);
      console.log(`      Title: ${r.title}`);
      console.log(`      Content snippet: "${r.content.substring(0, 100)}..."`);
    });

    if (resultsA.length > 0 && resultsA[0].sectionNumber === 'Section 27') {
      console.log('  ✅ TEST 1 PASSED: Successfully retrieved Section 27 (Restraint of Trade) from MongoDB.');
    } else {
      console.error('  ❌ TEST 1 FAILED: Could not retrieve Section 27.');
    }

    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n⚖️  TEST 2: Dynamic MongoDB Full-Text Retrieval (Arbitration Appointment)');
    const clauseB = 'All disputes shall be referred to a sole arbitrator appointed unilaterally by the Company.';
    const resultsB = await retrieveRelevantLaws(clauseB, 'arbitration');

    console.log(`  Clause: "${clauseB}"`);
    console.log(`  Retrieved Matches: ${resultsB.length}`);
    resultsB.forEach((r, idx) => {
      console.log(`    [Match ${idx + 1}] ${r.actName} - ${r.sectionNumber}`);
      console.log(`      Title: ${r.title}`);
    });

    if (resultsB.length > 0 && resultsB[0].actKey === 'ARBITRATION_ACT') {
      console.log('  ✅ TEST 2 PASSED: Successfully retrieved Arbitration Act guidelines.');
    } else {
      console.error('  ❌ TEST 2 FAILED: Could not retrieve Arbitration guidelines.');
    }

    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n🛡️  TEST 3: Tier 2 Cascading Fail-Safe Fallback (Database Offline Simulation)');
    // Simulate database offline by closing the mongoose connection
    console.log('  🔌 Disconnecting MongoDB to simulate server crash...');
    await mongoose.disconnect();
    console.log('  🔌 Disconnected.');

    const clauseC = 'The employee shall keep all compensation details confidential.';
    console.log(`  Attempting retrieval for clause: "${clauseC}"`);
    const resultsC = await retrieveRelevantLaws(clauseC, 'confidentiality');

    console.log(`  Retrieved Matches: ${resultsC.length}`);
    resultsC.forEach((r, idx) => {
      console.log(`    [Playbook Match ${idx + 1}] ${r.actName} - ${r.sectionNumber}`);
      console.log(`      Title: ${r.title}`);
    });

    if (resultsC.length > 0) {
      console.log('  ✅ TEST 3 PASSED: Zero-crash safety active! Gracefully fell back to local Playbook guidelines.');
    } else {
      console.error('  ❌ TEST 3 FAILED: Could not fall back to local Playbook.');
    }

  } catch (err) {
    console.error('❌ RAG test suite crashed:', err);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    console.log('\n🟢 RAG test suite run completed.');
  }
}

runTestRAG();
