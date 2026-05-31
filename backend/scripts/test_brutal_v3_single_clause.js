require('dotenv').config();
const mongoose = require('mongoose');
const Contract = require('../src/models/Contract');
const Clause = require('../src/models/Clause');
const User = require('../src/models/User');
const { processContractJob } = require('../src/services/jobQueueService');

const brutalContractText = `
EMPLOYMENT AGREEMENT
The Employee agrees that female employees are entitled to a maximum of 12 weeks of unpaid maternity leave upon completing two years of service.
The Employee shall be granted a generous annual performance bonus equal to 20% of their base salary.
Notwithstanding anything contained in Clause 2, the Employee shall receive absolutely no financial benefits, bonuses, or allowances other than the fixed base salary.
`;

async function runBrutalTestV3() {
  console.log("🔥 Starting Micro Brutal Test 🔥");
  
  await mongoose.connect(process.env.MONGODB_URI);
  
  let user = await User.findOne({ email: 'admin@lexguard.com' });
  if (!user) user = await User.create({ name: 'Admin', email: 'admin@lexguard.com', passwordHash: 'dummy', role: 'admin' });

  const contract = await Contract.create({
    userId: user._id,
    originalFileName: 'Brutal_Micro.txt',
    contractCategory: 'other',
    rawText: brutalContractText,
    totalClauses: 3
  });

  const clausesText = [
    "The Employee agrees that female employees are entitled to a maximum of 12 weeks of unpaid maternity leave upon completing two years of service.",
    "The Employee shall be granted a generous annual performance bonus equal to 20% of their base salary.",
    "Notwithstanding anything contained in Clause 2, the Employee shall receive absolutely no financial benefits, bonuses, or allowances other than the fixed base salary."
  ];

  for (let i = 0; i < clausesText.length; i++) {
    await Clause.create({ contractId: contract._id, segmentIndex: i, rawText: clausesText[i] });
  }

  await processContractJob(contract._id);

  console.log("\n\n📊 --- RESULTS --- 📊\n");
  const results = await Clause.find({ contractId: contract._id }).sort({ segmentIndex: 1 });
  for (const c of results) {
    console.log(`\nCLAUSE: ${c.rawText}`);
    console.log(`RISK: ${c.risk_level}`);
    if (c.possible_law_references && c.possible_law_references.length > 0) {
      for (const ref of c.possible_law_references) {
         console.log(`📜 [${ref.verification_status}] ${ref.act_name}`);
      }
    }
    console.log(`🧠 CONFIDENCE: ${c.overall_confidence_score}`);
  }

  const updatedContract = await Contract.findById(contract._id);
  if (updatedContract.crossRefFindings && updatedContract.crossRefFindings.length > 0) {
    console.log(`\n🔗 CROSS-REFERENCE FINDINGS:`);
    for (const finding of updatedContract.crossRefFindings) {
      console.log(` - ${finding.issue_text}`);
    }
  }

  await mongoose.disconnect();
}

runBrutalTestV3().catch(err => {
  console.error("❌ Test Failed:", err);
  mongoose.disconnect();
});
