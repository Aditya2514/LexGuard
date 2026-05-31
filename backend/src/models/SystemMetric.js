const mongoose = require('mongoose');

const systemMetricSchema = new mongoose.Schema({
  metricType: { 
    type: String, 
    required: true,
    index: true
  }, // e.g., 'API_TOKEN_USAGE', 'LLM_LATENCY'
  provider: { 
    type: String, 
    required: true,
    index: true
  }, // e.g., 'groq', 'gemini', 'grok', 'huggingface'
  value: { 
    type: Number, 
    required: true 
  }, // token count or milliseconds
  metadata: { 
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }, // e.g., { model: 'llama-3.1-8b-instant' }
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: '90d' // Auto-delete after 90 days
  }
});

module.exports = mongoose.model('SystemMetric', systemMetricSchema);
