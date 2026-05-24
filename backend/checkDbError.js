require('dotenv').config();
const mongoose = require('mongoose');
const QueueJob = require('./src/models/QueueJob');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const job = await QueueJob.findOne({ status: 'failed' }).sort({ updatedAt: -1 });
  console.log('Failed Job Error:', job.error);
  process.exit(0);
}

check();
