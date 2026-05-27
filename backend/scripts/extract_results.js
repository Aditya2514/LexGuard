require('dotenv').config();
const mongoose = require('mongoose');
const Contract = require('../src/models/Contract');
const Clause = require('../src/models/Clause');

async function extract() {
  await mongoose.connect(process.env.MONGODB_URI);
  const contract = await Contract.findOne({ originalFileName: 'Brutal_Test_Contract.txt' }).sort({ createdAt: -1 });
  if (!contract) {
    console.log("No contract found.");
    return;
  }
  const clauses = await Clause.find({ contractId: contract._id }).sort({ segmentIndex: 1 });
  
  console.log("\n\n📊 --- BRUTAL TEST RESULTS (Partial) --- 📊\n");
  for (const c of clauses) {
    console.log(`\n======================================================`);
    console.log(`CLAUSE ${c.segmentIndex}: ${c.rawText}`);
    console.log(`TYPE: ${c.clause_type} | RISK: ${c.risk_level} | COMPLIANCE: ${c.compliance_risk_level}`);
    if (c.possible_law_references && c.possible_law_references.length > 0) {
      console.log(`\n📜 LAW REFERENCES:`);
      for (const ref of c.possible_law_references) {
         console.log(` - [${ref.verification_status}] ${ref.act_name}: ${ref.section_hint}`);
      }
    }
  }

  if (contract.crossRefFindings && contract.crossRefFindings.length > 0) {
    console.log(`\n======================================================`);
    console.log(`🔗 CROSS-REFERENCE FINDINGS:`);
    for (const finding of contract.crossRefFindings) {
      console.log(` - [${finding.severity}] ${finding.type}: ${finding.issue_text}`);
    }
  }
  await mongoose.disconnect();
}
extract();
