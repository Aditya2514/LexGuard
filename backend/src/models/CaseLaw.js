const mongoose = require('mongoose');

const caseLawSchema = new mongoose.Schema({
  caseName: {
    type: String,
    required: true,
  },
  citation: {
    type: String,
    required: true,
  },
  court: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    required: true,
  },
  holdings: [{
    type: String, // The core principles established by this case
  }],
  pineconeId: {
    type: String,
    unique: true,
    required: true,
  },
  referenceUrl: {
    type: String,
  }
}, { timestamps: true });

module.exports = mongoose.model('CaseLaw', caseLawSchema);
