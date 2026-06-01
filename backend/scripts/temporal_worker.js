const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const temporalCronService = require('../src/services/temporalCronService');

async function runWorker() {
  try {
    console.log("Connecting to MongoDB for Temporal Sweep...");
    await mongoose.connect(process.env.MONGODB_URI);
    
    const startTime = Date.now();
    await temporalCronService.syncTemporalRules();
    const duration = Date.now() - startTime;
    
    console.log(`✅ Temporal Worker finished successfully in ${duration}ms.`);
    process.exit(0);
  } catch (error) {
    console.error("🔴 Temporal Worker Failed:", error);
    process.exit(1);
  }
}

runWorker();
