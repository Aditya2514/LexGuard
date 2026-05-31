require('dotenv').config();
const mongoose = require('mongoose');
const SystemMetric = require('../src/models/SystemMetric');

async function checkMetrics() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const tokenMetrics = await SystemMetric.find({ metricType: 'API_TOKEN_USAGE' }).sort({ createdAt: -1 }).limit(5);
  const latencyMetrics = await SystemMetric.find({ metricType: 'LLM_LATENCY' }).sort({ createdAt: -1 }).limit(5);

  console.log("=== Recent API Token Usage ===");
  tokenMetrics.forEach(m => {
    console.log(`Provider: ${m.provider}, Model: ${m.metadata.model}, Tokens: ${m.value}, Time: ${m.createdAt}`);
  });

  console.log("\n=== Recent LLM Latency ===");
  latencyMetrics.forEach(m => {
    console.log(`Provider: ${m.provider}, Model: ${m.metadata.model}, Latency: ${m.value}ms, Time: ${m.createdAt}`);
  });

  await mongoose.disconnect();
}
checkMetrics();
