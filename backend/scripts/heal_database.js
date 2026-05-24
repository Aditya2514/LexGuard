require('dotenv').config();
const mongoose = require('mongoose');
const StatuteNode = require('../src/models/StatuteNode');

async function healDatabase() {
  console.log("🏥 [Auto-Heal] Initializing Database Repair Sequence...");
  
  if (!process.env.MONGODB_URI) {
    console.error("🚨 Missing MONGODB_URI.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("☁️ Connected to MongoDB Atlas.");

  // 1. Find all acts that look like garbled hashes or purely numbers
  const actsToFix = await StatuteNode.aggregate([
    { $group: { _id: '$actName', count: { $sum: 1 } } }
  ]);

  for (const act of actsToFix) {
    const actName = act._id;
    // Heuristic: If it has 15+ characters with no spaces (hash), or starts with "A20", or is just numbers
    const isGarbled = actName.length > 25 && !actName.includes(' ') || 
                      /^[0-9]+$/.test(actName) || 
                      actName.startsWith('A20') || 
                      actName.startsWith('a19') ||
                      actName.startsWith('A18') ||
                      actName.startsWith('aA20') ||
                      actName.length > 30; // Catch long hashes

    if (isGarbled) {
      console.log(`\n🔍 Found garbled Act Name: ${actName}`);
      
      // Try to find the real name by looking at the first section
      const firstSection = await StatuteNode.findOne({ actName: actName }).sort({ sectionNumber: 1 });
      
      if (firstSection && firstSection.content) {
        // Try to find a phrase like "called the [Name] Act, 19YY"
        const match = firstSection.content.match(/(?:called\s+the|known\s+as\s+the)\s+([A-Za-z\s]+Act,\s*\d{4})/i);
        let newActName = '';
        
        if (match && match[1]) {
          newActName = match[1].trim();
        } else {
          // Fallback: take the first 5 words of the content
          newActName = firstSection.content.split(' ').slice(0, 5).join(' ') + '...';
        }
        
        console.log(`   ✨ Renaming to: ${newActName}`);
        
        // Update all documents with this garbled actName
        const res = await StatuteNode.updateMany(
          { actName: actName },
          { $set: { actName: newActName } }
        );
        console.log(`   ✅ Fixed ${res.modifiedCount} nodes.`);
      }
    }
  }

  console.log(`\n══ 🏆 AUTO-HEAL COMPLETE ══`);
  await mongoose.disconnect();
}

healDatabase().catch(console.error);
