const mongoose = require('mongoose');

const legalDomainMapSchema = new mongoose.Schema({
  contractType: { 
    type: String, 
    required: true, 
    index: true 
  }, // e.g., "Employment", "SaaS_Vendor", "Real_Estate"
  clauseType: { 
    type: String, 
    required: true, 
    index: true 
  },   // e.g., "non_compete", "confidentiality", "indemnification"
  targetDomains: [{ 
    type: String 
  }], // e.g., ["labor_law", "data_privacy", "corporate_compliance"]
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Enforce compound uniqueness to keep mapping records pristine
legalDomainMapSchema.index({ contractType: 1, clauseType: 1 }, { unique: true });

module.exports = mongoose.model('LegalDomainMap', legalDomainMapSchema);
