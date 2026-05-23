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
  embedding: {
    type: [Number],
    required: true
  }
});

// Compound index to guarantee lookup performance and enforce no double-ingestion of the same section
statuteNodeSchema.index({ actName: 1, sectionNumber: 1 }, { unique: true });

module.exports = mongoose.model('StatuteNode', statuteNodeSchema, 'statutes');
