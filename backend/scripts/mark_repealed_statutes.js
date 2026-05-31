require('dotenv').config();
const mongoose = require('mongoose');
const StatuteNode = require('../src/models/StatuteNode');

async function markRepealedStatutes() {
    console.log("🚀 Connecting to MongoDB to mark repealed statutes...");
    await mongoose.connect(process.env.MONGODB_URI);

    const repealedActs = [
        { regex: /Indian Penal Code/i, replacedBy: 'BNS (Bharatiya Nyaya Sanhita, 2023)' },
        { regex: /Code of Criminal Procedure/i, replacedBy: 'BNSS (Bharatiya Nagarik Suraksha Sanhita, 2023)' },
        { regex: /Indian Evidence Act/i, replacedBy: 'BSA (Bharatiya Sakshya Adhiniyam, 2023)' }
    ];

    let totalUpdated = 0;

    for (const rule of repealedActs) {
        const result = await StatuteNode.updateMany(
            { actName: { $regex: rule.regex } },
            { 
                $set: { 
                    isRepealed: true, 
                    repealedBy: rule.replacedBy 
                } 
            }
        );
        console.log(`Marked ${result.modifiedCount} sections of ${rule.regex} as repealed by ${rule.replacedBy}`);
        totalUpdated += result.modifiedCount;
    }

    console.log(`✅ Finished marking ${totalUpdated} statutes as repealed.`);
    process.exit(0);
}

markRepealedStatutes();
