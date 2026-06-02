require('dotenv').config();
const mongoose = require('mongoose');
const graphRagService = require('../src/services/graphRagService');

async function testGraphRag() {
  console.log('🧪 Testing GraphRAG Retrieval Pipeline...');
  
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // We test with a classic Non-Compete clause that should hit Section 27 and Zaheer Khan precedent
  const clauseText = "The Employee agrees that during the term of employment and for a period of 24 months thereafter, they shall not engage in any competing business anywhere in India.";
  
  console.log('\n--- Initiating Graph Traversal ---');
  console.time('GraphRAGLatency');
  
  const context = await graphRagService.retrieveAugmentedContext(
    "employment",
    "non_compete",
    clauseText,
    "Central"
  );
  
  console.timeEnd('GraphRAGLatency');
  
  console.log('\n=== RETRIEVED CONTEXT ===');
  console.log(context);
  console.log('=========================\n');

  if (context.includes('GRAPH RAG COMPLIANCE CONTEXT')) {
      console.log('✅ GraphRAG successfully generated augmented context!');
      
      if (context.includes('[Binding Precedents') || context.includes('[Structural Dependencies]')) {
          console.log('🎯 Edge Traversal Successful: Retrieved connected precedents or dependencies!');
      } else {
          console.log('⚠️ Note: No connected edges found for this specific query, but base retrieval worked.');
      }
  } else {
      console.log('❌ Failed to retrieve augmented context.');
  }

  await mongoose.connection.close();
  const graphDriver = require('../src/services/graphDriver');
  await graphDriver.close();
}

testGraphRag().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
