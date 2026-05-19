require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Clause = require('./src/models/Clause.js');
  
  // Find clauses for the contract we just uploaded
  const clauses = await Clause.find({ contractId: '6a0b1e43abbf9fbd1ef9c94c' }).sort({ segmentIndex: 1 });
  
  clauses.forEach(c => {
    console.log(`\n--- Clause ${c.segmentIndex} ---`);
    console.log(`Risk: ${c.risk_level} (Score: ${c.risk_score})`);
    if (c.risk_reasons && c.risk_reasons.length > 0) {
      console.log(`Reasons: ${c.risk_reasons.join(' | ')}`);
    }
    if (c.plain_language_explanation) {
      console.log(`Expl: ${c.plain_language_explanation}`);
    }
    if (c.negotiation_tip) {
      console.log(`Tip: ${c.negotiation_tip}`);
    }
    if (c.compliance_risk_level) {
      console.log(`Compliance: ${c.compliance_risk_level}`);
    }
    if (c.possible_law_references && c.possible_law_references.length > 0) {
      console.log(`Law Hint: ${c.possible_law_references[0].act_name} - ${c.possible_law_references[0].reason}`);
    }
    if (c.explanatory_note) {
      console.log(`Comp Expl: ${c.explanatory_note}`);
    }
  });
  
  mongoose.disconnect();
}
test().catch(console.error);
