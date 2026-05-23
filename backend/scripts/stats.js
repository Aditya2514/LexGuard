require('dotenv').config();
const mongoose = require('mongoose');
const StatuteNode = require('../src/models/StatuteNode');

async function getStats() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const stats = await StatuteNode.aggregate([
    { $group: { _id: '$actName', count: { $sum: 1 }, domain: { $first: '$domain' } } },
    { $sort: { count: -1 } }
  ]);
  
  console.table(stats.map(s => ({
    "Act/Law": s._id,
    "Domain": s.domain,
    "Total Sections/Nodes": s.count
  })));
  
  const total = stats.reduce((acc, curr) => acc + curr.count, 0);
  console.log(`\n================================`);
  console.log(`🏆 TOTAL KNOWLEDGE NODES: ${total}`);
  console.log(`================================`);
  
  await mongoose.disconnect();
}

getStats().catch(console.error);
