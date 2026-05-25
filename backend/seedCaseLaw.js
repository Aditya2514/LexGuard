require('dotenv').config();
const mongoose = require('mongoose');
const { seedCaseLaw } = require('./src/services/ragCaseLawService');
const CaseLaw = require('./src/models/CaseLaw');

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing to avoid duplicates in this test
        await CaseLaw.deleteMany({});
        console.log('🧹 Cleared existing Case Law records.');

        const landmarkCases = [
            {
                case_title: 'Niranjan Shankar Golikari v. Century Spinning',
                citation: '1967 AIR 1098',
                legal_domain: 'employment, non_compete',
                summary: 'The Supreme Court of India held that a negative covenant restraining an employee from working for a competitor DURING the term of their employment is not in restraint of trade under Section 27 of the Indian Contract Act and is valid and enforceable. However, post-employment restrictions are void.'
            },
            {
                case_title: 'Percept D\'Mark (India) Pvt. Ltd. v. Zaheer Khan',
                citation: '2006 (4) SCC 227',
                legal_domain: 'employment, exclusivity, non_compete',
                summary: 'The Supreme Court ruled that a restrictive covenant extending beyond the term of the contract is void under Section 27 of the Indian Contract Act. The doctrine of restraint of trade does not apply during the continuance of the contract, but strictly applies after its termination.'
            },
            {
                case_title: 'Central Inland Water Transport Corporation v. Brojo Nath Ganguly',
                citation: '1986 AIR 1571',
                legal_domain: 'employment, termination, unconscionable_contract',
                summary: 'The Supreme Court struck down a rule that allowed a government company to terminate permanent employees without assigning reasons by giving 3 months notice. Held that unconscionable, unfair, and unreasonable terms in standard form contracts between parties with unequal bargaining power are void under Section 23 of the Indian Contract Act (opposed to public policy).'
            }
        ];

        for (const c of landmarkCases) {
            await seedCaseLaw(c.case_title, c.citation, c.legal_domain, c.summary);
            // Brief pause for HF rate limit
            await new Promise(r => setTimeout(r, 1500));
        }

        console.log('🎉 Seeding complete!');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

seedDatabase();
