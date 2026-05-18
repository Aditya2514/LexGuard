const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const LawSection = require('../src/models/LawSection');
const { LEGAL_PLAYBOOK } = require('../src/config/legalPlaybook');

async function seedDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in environment variables.');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB for seeding...');
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected successfully!');

    // 1. Clean existing sections
    console.log('🧹 Clearing existing LawSection documents...');
    const deleteRes = await LawSection.deleteMany({});
    console.log(`🧹 Done! Removed ${deleteRes.deletedCount} items.`);

    // 2. Build insertion list from LEGAL_PLAYBOOK
    console.log('📦 Processing legal sections from Playbook...');
    const insertList = [];

    for (const [clauseType, data] of Object.entries(LEGAL_PLAYBOOK)) {
      if (data && Array.isArray(data.guidelines)) {
        for (const g of data.guidelines) {
          // Flatten keywords including clauseType itself
          const extraKeywords = [
            clauseType,
            g.sectionNumber.toLowerCase(),
            g.actName.toLowerCase(),
          ];
          const uniqueKeywords = Array.from(new Set([
            ...extraKeywords,
            ...(g.keywords || []),
          ]));

          insertList.push({
            actKey: g.actKey,
            actName: g.actName,
            sectionNumber: g.sectionNumber,
            title: g.title,
            content: g.landmark_case ? `${g.content} Landmark Case: ${g.landmark_case}` : g.content,
            keywords: uniqueKeywords,
            referenceUrl: g.referenceUrl,
          });
        }
      }
    }

    // 3. Bulk insert to database
    console.log(`💾 Inserting ${insertList.length} legal records...`);
    const result = await LawSection.insertMany(insertList);
    console.log(`🎉 Seeding complete! Inserted ${result.length} legal sections into MONGODB.`);

  } catch (err) {
    console.error('❌ Seeding failed with error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

seedDatabase();
