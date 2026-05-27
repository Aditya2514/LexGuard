require('dotenv').config();
const mongoose = require('mongoose');
const Contract = require('../src/models/Contract');
const Clause = require('../src/models/Clause');
const User = require('../src/models/User');
const { processContractJob } = require('../src/services/jobQueueService');

const brutalContractText = `
THIS AGREEMENT FOR SALE is made in Mumbai, Maharashtra, India.
1. The Allottee shall pay 5% of the total consideration as an initial Expression of Interest. An additional 8% shall be paid as non-refundable administrative and processing charges prior to the execution of the Agreement for Sale.
2. The Developer agrees to fully indemnify the Allottee against all losses arising from structural defects.
3. Any disputes regarding electronic communications shall be governed strictly by Section 66A of the Information Technology Act, 2000.
4. Notwithstanding anything contained in Clause 2, the Developer's total aggregate liability for any and all claims under this Agreement shall be capped at ₹5,000.
`;

async function runBrutalTest() {
  console.log("🔥 Starting Brutal End-to-End Test 🔥");
  
  await mongoose.connect(process.env.MONGODB_URI);
  
  // 1. Get a User
  let user = await User.findOne({ email: 'admin@lexguard.com' });
  if (!user) {
    user = await User.create({
      name: 'Admin',
      email: 'admin@lexguard.com',
      passwordHash: 'dummy',
      role: 'admin'
    });
  }

  // 2. Create Contract
  const contract = await Contract.create({
    userId: user._id,
    originalFileName: 'Brutal_Test_Contract.txt',
    contractCategory: 'other',
    rawText: brutalContractText,
    totalClauses: 5
  });

  // 3. Create Clauses
  const clausesText = [
    "THIS AGREEMENT FOR SALE is made in Mumbai, Maharashtra, India.",
    "1. The Allottee shall pay 5% of the total consideration as an initial Expression of Interest. An additional 8% shall be paid as non-refundable administrative and processing charges prior to the execution of the Agreement for Sale.",
    "2. The Developer agrees to fully indemnify the Allottee against all losses arising from structural defects.",
    "3. Any disputes regarding electronic communications shall be governed strictly by Section 66A of the Information Technology Act, 2000.",
    "4. Notwithstanding anything contained in Clause 2, the Developer's total aggregate liability for any and all claims under this Agreement shall be capped at ₹5,000."
  ];

  for (let i = 0; i < clausesText.length; i++) {
    await Clause.create({
      contractId: contract._id,
      segmentIndex: i,
      rawText: clausesText[i]
    });
  }

  console.log(`✅ Created Contract ${contract._id} with 5 Clauses.`);
  console.log("🚀 Firing off Job Queue Pipeline...");

  // 4. Run Pipeline
  await processContractJob(contract._id);

  console.log("\n\n📊 --- BRUTAL TEST RESULTS --- 📊\n");
  
  // 5. Output Findings
  const results = await Clause.find({ contractId: contract._id }).sort({ segmentIndex: 1 });
  
  for (const c of results) {
    console.log(`\n======================================================`);
    console.log(`CLAUSE ${c.segmentIndex}: ${c.rawText}`);
    console.log(`TYPE: ${c.clause_type} | RISK: ${c.risk_level} | COMPLIANCE: ${c.compliance_risk_level}`);
    
    if (c.possible_law_references && c.possible_law_references.length > 0) {
      console.log(`\n📜 LAW REFERENCES:`);
      for (const ref of c.possible_law_references) {
         console.log(` - [${ref.verification_status}] ${ref.act_name}: ${ref.section_hint}`);
         console.log(`   Verification Note: ${ref.verification_note}`);
      }
    }

    console.log(`\n🧠 CONFIDENCE SCORE: ${c.overall_confidence_score} (${c.overall_confidence_level})`);
  }

  const updatedContract = await Contract.findById(contract._id);
  if (updatedContract.crossRefFindings && updatedContract.crossRefFindings.length > 0) {
    console.log(`\n======================================================`);
    console.log(`🔗 CROSS-REFERENCE FINDINGS (Agent 9):`);
    for (const finding of updatedContract.crossRefFindings) {
      console.log(` - [${finding.severity.toUpperCase()}] ${finding.type}: ${finding.issue_text}`);
    }
  }

  console.log(`\n✅ Brutal Test Complete.`);
  await mongoose.disconnect();
}

runBrutalTest().catch(err => {
  console.error("❌ Test Failed:", err);
  mongoose.disconnect();
});
