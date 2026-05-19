require('dotenv').config();
const mongoose = require('mongoose');
const { analyseRisksForContract } = require('./src/services/agent2RiskAnalyst');

(async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lexguard');
    console.log('Connected!');

    const contractId = '6a0af6964c2dde0626212b0b';
    console.log('\nRunning analyseRisksForContract...');
    await analyseRisksForContract(contractId);
    console.log('Success!');

  } catch (err) {
    console.error('\n❌ ERROR THROWN BY AGENT 2:', err);
  } finally {
    await mongoose.disconnect();
  }
})();
