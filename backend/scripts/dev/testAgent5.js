require('dotenv').config();
const mongoose = require('mongoose');
const { runAgent5LifecycleExtractor } = require('./src/services/agent5LifecycleExtractor');
const { checkUpcomingEvents } = require('./src/services/schedulerService');
const Contract = require('./src/models/Contract');
const Clause = require('./src/models/Clause');

async function testAgent5() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Create a dummy contract
        const dummyContract = await Contract.create({
            userId: new mongoose.Types.ObjectId(),
            originalFileName: 'test_renewal_contract.pdf',
            contractCategory: 'employment',
            status: 'processing'
        });

        // 2. Add a dummy clause with a complex relative date
        // Let's set it to 45 days from today so that a 30-day notice period triggers in 15 days.
        // Or better yet, we can give a date that forces the 30-day notice period to be right now (e.g., expiration is 25 days from now).
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 25);
        
        const clauseText = `This Master Service Agreement shall automatically expire on ${futureDate.toDateString()}. Either party may prevent automatic renewal by providing written notice at least 30 days prior to expiration.`;

        await Clause.create({
            contractId: dummyContract._id,
            rawText: clauseText,
            segmentIndex: 1
        });

        console.log(`\n📄 Created Dummy Contract: ${dummyContract._id}`);
        console.log(`Clause: "${clauseText}"`);

        // 3. Run Agent 5
        console.log(`\n🚀 Firing Agent 5 Lifecycle Extractor...`);
        await runAgent5LifecycleExtractor(dummyContract._id);

        const updatedContract = await Contract.findById(dummyContract._id).lean();
        console.log('\n======================================================');
        console.log('🤖 AGENT 5 EXTRACTED DATES:');
        console.log('======================================================');
        console.log(JSON.stringify(updatedContract.lifecycle_events, null, 2));

        // 4. Run Scheduler Manually
        console.log(`\n⏰ Running Scheduler Check...`);
        await checkUpcomingEvents();

    } catch (err) {
        console.error('❌ Test failed:', err);
    } finally {
        mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

testAgent5();
