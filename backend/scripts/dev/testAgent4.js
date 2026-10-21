require('dotenv').config();
const mongoose = require('mongoose');
const Contract = require('./src/models/Contract');
const Clause = require('./src/models/Clause');
const User = require('./src/models/User');
const { runAgent4FinancialAnalyst } = require('./src/services/agent4FinancialAnalyst');

async function testAgent4() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Create dummy user
    let user = await User.findOne();
    if (!user) {
        user = await User.create({
            name: 'Agent4 Tester',
            email: 'test_agent4@example.com',
            passwordHash: 'dummyhash123'
        });
    }

    // 2. Create dummy contract
    const contract = await Contract.create({
        userId: user._id,
        originalFileName: 'Financial_Test_Contract.pdf',
        contractCategory: 'employment',
        status: 'processing'
    });
    console.log(`📝 Created dummy contract: ${contract._id}`);

    // 3. Create dummy clauses with hidden financial obligations
    const clauseTexts = [
        "1. Position and Duties: You will be employed as a Software Engineer.",
        "2. Base Compensation: Your base salary will be INR 12,00,000 per annum, paid monthly. This is standard salary and should not be flagged as a penalty.",
        "3. Training Bond: The Company invests heavily in your training. If you leave within 24 months, you are liable to pay a penalty of INR 5,00,000.",
        "4. Equipment Fee: A non-refundable hardware setup fee of $250 will be deducted from your first paycheck.",
        "5. Liquidated Damages: Breach of the non-compete clause will result in liquidated damages of USD 50,000."
    ];

    for (let i = 0; i < clauseTexts.length; i++) {
        await Clause.create({
            contractId: contract._id,
            segmentIndex: i,
            rawText: clauseTexts[i],
            text: clauseTexts[i]
        });
    }
    console.log(`📄 Added ${clauseTexts.length} dummy clauses.`);

    // 4. Run Agent 4
    console.log(`\n🚀 Firing Agent 4 Financial Analyst...`);
    await runAgent4FinancialAnalyst(contract._id);

    // 5. Verify Results
    const updatedContract = await Contract.findById(contract._id);
    console.log('\n======================================================');
    console.log('💰 AGENT 4 FINANCIAL ANALYSIS RESULTS:');
    console.log('======================================================');
    console.log(`Total Financial Exposure: ${updatedContract.total_financial_exposure}`);
    console.log(`Financial Obligations Found: ${updatedContract.financial_obligations.length}`);
    console.log(JSON.stringify(updatedContract.financial_obligations, null, 2));

  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testAgent4();
