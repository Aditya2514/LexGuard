require('dotenv').config();
const mongoose = require('mongoose');
const StatuteNode = require('../src/models/StatuteNode');

async function checkActs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const acts = await StatuteNode.distinct('actName');
    
    console.log(`Found ${acts.length} distinct acts in the database:`);
    acts.forEach(act => console.log(`- ${act}`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkActs();
