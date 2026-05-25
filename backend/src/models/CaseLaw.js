const mongoose = require('mongoose');

const caseLawSchema = new mongoose.Schema({
  case_title: {
    type: String,
    required: true,
  },
  citation: {
    type: String,
    required: true,
  },
  legal_domain: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    required: true,
  },
  embedding: {
    type: [Number], // 384-dimensional vector
    default: [],
  }
}, { timestamps: true });

// Optional: create a basic text index for text searching if needed
caseLawSchema.index({ case_title: 'text', summary: 'text' });

module.exports = mongoose.model('CaseLaw', caseLawSchema);
