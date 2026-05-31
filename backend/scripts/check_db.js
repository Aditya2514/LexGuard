require('dotenv').config();
const mongoose = require('mongoose');
const StatuteNode = require('../src/models/StatuteNode');
const LawSection = require('../src/models/LawSection');
const CaseLaw = require('../src/models/CaseLaw');

async function checkCounts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const statuteCount = await StatuteNode.countDocuments();
    const lawSectionCount = await LawSection.countDocuments();
    const caseLawCount = await CaseLaw.countDocuments();
    
    console.log('--- Ingestion Status ---');
    console.log(`StatuteNode count: ${statuteCount}`);
    console.log(`LawSection count: ${lawSectionCount}`);
    console.log(`CaseLaw count: ${caseLawCount}`);
    
    const sampleStatutes = await StatuteNode.find().limit(3);
    console.log('\nSample StatuteNode act_names:');
    sampleStatutes.forEach(s => console.log(` - ${s.act_name}: Section ${s.section_number}`));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkCounts();
