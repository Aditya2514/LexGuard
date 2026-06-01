const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { generateEmbedding } = require('../src/services/embeddingService');
const StatuteNode = require('../src/models/StatuteNode');

// Ensure you run this from the backend root: `node scripts/ingest_state_laws.js`

async function runIngestion() {
    console.log('🏛️ Starting State Law Ingestion Engine (Phase 8)...');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas.');

        // Example: The Karnataka Shops and Commercial Establishments Act
        // In a real scenario, this text would be extracted via pdf-parse from the bare act PDF
        const targetActName = 'Karnataka Shops and Commercial Establishments Act, 1961';
        const jurisdiction = 'Karnataka';
        const domain = 'labor_law';

        const rawActs = [
            {
                section: 'Section 7: Daily and weekly hours',
                title: 'Working Hours Limit',
                content: 'No employee in any establishment shall be required or allowed to work for more than nine hours on any day and forty-eight hours in any week: Provided that the total number of hours of work including overtime shall not exceed ten hours in any day except on days of stock-taking and preparation of accounts.',
                hierarchy_level: 'SECTION'
            },
            {
                section: 'Section 15: Leave with wages',
                title: 'Annual Leave Earned',
                content: 'Every employee who has worked for a period of two hundred and forty days or more in an establishment during a calendar year shall be allowed during the subsequent calendar year, leave with wages for a number of days calculated at the rate of— (i) if an adult, one day for every twenty days of work performed by him during the previous calendar year; (ii) if a young person, one day for every fifteen days of work performed by him.',
                hierarchy_level: 'SECTION'
            },
            {
                section: 'Section 39: Notice of Dismissal',
                title: 'Termination Rules',
                content: 'No employer shall remove or dismiss an employee who has put in service under him continuously for a period of not less than six months, except for a reasonable cause and unless and until one month’s previous notice or pay in lieu thereof has been given to him.',
                hierarchy_level: 'SECTION'
            }
        ];

        console.log(`\nFound ${rawActs.length} sections for [${jurisdiction}]. Embedding and syncing...`);

        let ingestedCount = 0;

        for (const act of rawActs) {
            // Generate Vector Embedding for the content
            console.log(`- Generating vector for: ${act.section}...`);
            const vector = await generateEmbedding(act.content, 'document');

            // Upsert into Database
            await StatuteNode.findOneAndUpdate(
                { actName: targetActName, sectionNumber: act.section },
                {
                    actName: targetActName,
                    sectionNumber: act.section,
                    content: `Title: ${act.title}\n\n${act.content}`,
                    domain: domain,
                    jurisdiction: jurisdiction,
                    embedding: vector,
                    isRepealed: false,
                    lastUpdated: new Date()
                },
                { upsert: true, new: true }
            );
            ingestedCount++;
        }

        console.log(`\n🎉 Successfully ingested ${ingestedCount} State Law vectors for ${jurisdiction}.`);
        console.log(`⚠️ REMINDER: Ensure you have added {"path": "jurisdiction", "type": "filter"} to your Atlas Search Index JSON definition.`);

    } catch (err) {
        console.error('❌ Ingestion Error:', err);
    } finally {
        mongoose.disconnect();
        process.exit(0);
    }
}

runIngestion();
