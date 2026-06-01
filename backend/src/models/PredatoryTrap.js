const mongoose = require('mongoose');

const predatoryTrapSchema = new mongoose.Schema({
  trap_type: {
    type: String,
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['high', 'critical'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  embedding: {
    type: [Number], // 1024-d BGE-m3 vector
    required: true
  }
}, { timestamps: true });

// Create a 2dsphere or vector index in MongoDB Atlas for the embedding field
// Note: Actual Vector Search index configuration requires Atlas Search UI/API setup
// using {"type": "knnVector", "dimensions": 1024, "similarity": "cosine"}

const PredatoryTrap = mongoose.model('PredatoryTrap', predatoryTrapSchema);

module.exports = PredatoryTrap;
