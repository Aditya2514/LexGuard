require('dotenv').config();
const mongoose = require('mongoose');
const Contract = require('./src/models/Contract');
const Clause = require('./src/models/Clause');

(async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lexguard');
    console.log('Connected!');

    const contractId = '6a0af6964c2dde0626212b0b';
    const contract = await Contract.findById(contractId);
    console.log('\n--- CONTRACT ---');
    console.log(JSON.stringify(contract, null, 2));

    const clauses = await Clause.find({ contractId });
    console.log(`\nFound ${clauses.length} clauses:`);
    clauses.forEach((c, idx) => {
      console.log(`\nClause ${idx + 1}:`);
      console.log(`  _id: ${c._id}`);
      console.log(`  segmentIndex: ${c.segmentIndex}`);
      console.log(`  rawText: "${c.rawText.substring(0, 60)}..."`);
      console.log(`  clause_type: ${c.clause_type}`);
      console.log(`  risk_level: ${c.risk_level}`);
      console.log(`  compliance_risk_level: ${c.compliance_risk_level}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
})();
