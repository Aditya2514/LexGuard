require('dotenv').config();
const mongoose = require('mongoose');
const StatuteNode = require('../src/models/StatuteNode');

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connected to MongoDB.');

        const nodes = await StatuteNode.find({ 
            actName: 'THE INDIAN CONTRACT ACT, 1872',
            sectionNumber: /^Section 27\b/i
        }).select('sectionNumber').lean();
        console.log(`Nodes matching "Section 27" in Contract Act:`);
        console.log(nodes);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected.');
    }
}

run();
