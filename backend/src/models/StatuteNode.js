const mongoose = require('mongoose');

const statuteNodeSchema = new mongoose.Schema({
  actName: { type: String, required: true },       // e.g., "Digital Personal Data Protection Act, 2023"
  sectionNumber: { type: String, required: true }, // e.g., "Section 4"
  content: { type: String, required: true },       // Raw section statutory text
  domain: { 
    type: String, 
    required: true, 
    index: true 
  }, // Taxonomy bucket matching our LegalDomainMap (e.g., "data_privacy", "labor_law")
  jurisdiction: {
    type: String,
    required: true,
    default: "Central",
    index: true
  }, // e.g., "Central", "Maharashtra", "Karnataka"
  embedding: {
    type: [Number],
    required: true
  },
  isRepealed: { type: Boolean, default: false, index: true },
  repealedBy: { type: String, default: null },     // e.g. "Bharatiya Nyaya Sanhita, 2023"
  effectiveDate: { type: Date, default: null },       // When this provision came into force
  amendedDate: { type: Date, default: null }       // Last amendment date
});

// Compound index to guarantee lookup performance and enforce no double-ingestion of the same section
statuteNodeSchema.index({ actName: 1, sectionNumber: 1 }, { unique: true });

module.exports = mongoose.model('StatuteNode', statuteNodeSchema, 'statutes');
