const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://adityasinghv05_db_user:2DyeONBJAFzC2lVT@cluster0.y5an0e0.mongodb.net/lexguard?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
  await mongoose.connect(MONGODB_URI);
  const ContractSchema = new mongoose.Schema({}, { strict: false });
  const ClauseSchema = new mongoose.Schema({}, { strict: false });

  const Contract = mongoose.model('Contract', ContractSchema);
  const Clause = mongoose.model('Clause', ClauseSchema);

  const saas = await Contract.findOne({ originalFileName: 'saas.docx' }).sort({ uploadedAt: -1 });
  if (!saas) {
    console.log("No saas.docx found");
    return;
  }
  
  console.log(`Found saas.docx: ${saas._id}`);
  const clauses = await Clause.find({ contractId: saas._id }).sort({ segmentIndex: 1 });
  
  console.log(`Clauses count: ${clauses.length}`);
  if (clauses.length > 0) {
    const c = clauses[0];
    console.log("--- Clause 0 ---");
    console.log("risk_level:", c.risk_level);
    console.log("compliance_risk_level:", c.compliance_risk_level);
    console.log("possible_law_references length:", c.possible_law_references?.length);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
