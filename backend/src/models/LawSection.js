const mongoose = require('mongoose');

const lawSectionSchema = new mongoose.Schema({
  actKey: {
    type: String,
    required: true,
  },
  actName: {
    type: String,
    required: true,
  },
  sectionNumber: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  keywords: {
    type: [String],
    default: [],
  },
  referenceUrl: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Create compound text index to support full-text search over title, content, and keywords
lawSectionSchema.index({
  title: 'text',
  content: 'text',
  keywords: 'text',
}, {
  weights: {
    title: 10,
    keywords: 5,
    content: 1,
  },
  name: 'LawSectionTextIndex',
});

module.exports = mongoose.model('LawSection', lawSectionSchema);
