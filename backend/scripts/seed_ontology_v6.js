require('dotenv').config();
const mongoose = require('mongoose');
const LegalDomainMap = require('../src/models/LegalDomainMap');

const ONTOLOGY_SEED_DATA = [
  {
    contractType: "Employment",
    clauseType: "non_compete",
    targetDomains: ["labor_law", "general_contract_law"]
  },
  {
    contractType: "Employment",
    clauseType: "confidentiality",
    targetDomains: ["data_privacy", "labor_law"]
  },
  {
    contractType: "SaaS_Vendor",
    clauseType: "intellectual_property",
    targetDomains: ["intellectual_property_law", "corporate_compliance"]
  }
];

async function initializeV6Ontology() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("💾 MongoDB Connected for Ontology Seeding.");

  await LegalDomainMap.deleteMany({});
  await LegalDomainMap.insertMany(ONTOLOGY_SEED_DATA);

  console.log("══ 🏆 LEGAL ONTOLOGY MAP COMPLETELY INITIALIZED ══");
  await mongoose.disconnect();
}

initializeV6Ontology().catch(console.error);
