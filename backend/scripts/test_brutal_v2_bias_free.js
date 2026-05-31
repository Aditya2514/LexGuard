require('dotenv').config();
const mongoose = require('mongoose');
const Contract = require('../src/models/Contract');
const Clause = require('../src/models/Clause');
const User = require('../src/models/User');
const { processContractJob } = require('../src/services/jobQueueService');

const brutalContractText = `
EMPLOYMENT AGREEMENT

This Employment Agreement is entered into in Pune, Maharashtra, India.
1. The Employee agrees that female employees are entitled to a maximum of 12 weeks of unpaid maternity leave upon completing two years of service.
2. The Employee shall be eligible for gratuity strictly upon the continuous and uninterrupted completion of 10 years of service with the Company.
3. The Company shall deduct Professional Tax for the state of Maharashtra at a flat rate of ₹5,000 per month from the Employee's salary.
4. The Employee shall be granted a generous annual performance bonus equal to 20% of their base salary.
5. All disputes related to remote work shall be governed exclusively by the Indian Remote Workers and Artificial Intelligence Standards Act, 2024.
6. Notwithstanding anything contained in Clause 4 or any other provision of this Agreement, the Employee shall receive absolutely no financial benefits, bonuses, or allowances other than the fixed base salary.
`;

async function runBrutalTestV2() {
  console.log("🔥 Starting Brutal End-to-End V2 Test (Employment Focus) 🔥");
  
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
    originalFileName: 'Brutal_Employment_Contract.txt',
    contractCategory: 'other',
    rawText: brutalContractText,
    totalClauses: 7
  });

  // 3. Create Clauses
  const clausesText = [
    "EMPLOYMENT AGREEMENT\nThis Employment Agreement is entered into in Pune, Maharashtra, India.",
    "1. The Employee agrees that female employees are entitled to a maximum of 12 weeks of unpaid maternity leave upon completing two years of service.",
    "2. The Employee shall be eligible for gratuity strictly upon the continuous and uninterrupted completion of 10 years of service with the Company.",
    "3. The Company shall deduct Professional Tax for the state of Maharashtra at a flat rate of ₹5,000 per month from the Employee's salary.",
    "4. The Employee shall be granted a generous annual performance bonus equal to 20% of their base salary.",
    "5. All disputes related to remote work shall be governed exclusively by the Indian Remote Workers and Artificial Intelligence Standards Act, 2024.",
    "6. Notwithstanding anything contained in Clause 4 or any other provision of this Agreement, the Employee shall receive absolutely no financial benefits, bonuses, or allowances other than the fixed base salary."
  ];

  for (let i = 0; i < clausesText.length; i++) {
    await Clause.create({
      contractId: contract._id,
      segmentIndex: i,
      rawText: clausesText[i]
    });
  }

  console.log(`✅ Created Contract ${contract._id} with 7 Clauses.`);
  console.log("🚀 Firing off Job Queue Pipeline...");

  // 4. Run Pipeline
  await processContractJob(contract._id);

  console.log("\n\n📊 --- BRUTAL V2 TEST RESULTS --- 📊\n");
  
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

    if (c.agent2_risk_notes) {
      console.log(`\n⚠️ AGENT 2 NOTES: ${c.agent2_risk_notes}`);
    }

    console.log(`\n🧠 CONFIDENCE SCORE: ${c.overall_confidence_score} (${c.overall_confidence_level})`);
    if (c.confidence_factors) {
      console.log(`   Legal Grounding: ${c.confidence_factors.legal_grounding_score}`);
      console.log(`   Ambiguity: ${c.confidence_factors.ambiguity_penalty}`);
      console.log(`   Citation Accuracy: ${c.confidence_factors.citation_accuracy_score}`);
    }
  }

  const updatedContract = await Contract.findById(contract._id);
  if (updatedContract.crossRefFindings && updatedContract.crossRefFindings.length > 0) {
    console.log(`\n======================================================`);
    console.log(`🔗 CROSS-REFERENCE FINDINGS (Agent 9):`);
    for (const finding of updatedContract.crossRefFindings) {
      console.log(` - [${finding.severity.toUpperCase()}] ${finding.type}: ${finding.issue_text}`);
    }
  }

  console.log(`\n✅ Brutal V2 Test Complete.`);
  await mongoose.disconnect();
}

runBrutalTestV2().catch(err => {
  console.error("❌ Test Failed:", err);
  mongoose.disconnect();
});
