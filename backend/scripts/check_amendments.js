require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const StatuteNode = require('../src/models/StatuteNode');

// Mock list of authoritative sources
const GOVERNMENT_PORTALS = [
    {
        actName: "Digital Personal Data Protection Act, 2023",
        url: "https://www.indiacode.nic.in/dpdp2023.pdf",
        jurisdiction: "Central",
        currentMockHash: "a1b2c3d4" // Simulated hash of the PDF
    },
    {
        actName: "MahaRERA (Maharashtra Real Estate Regulatory Authority) Rules, 2017",
        url: "https://maharera.mahaonline.gov.in/rules2017.pdf",
        jurisdiction: "Maharashtra",
        currentMockHash: "e5f6g7h8"
    },
    {
        actName: "Karnataka Industrial Employment (Standing Orders) Rules, 1961",
        url: "https://labour.karnataka.gov.in/standingorders.pdf",
        jurisdiction: "Karnataka",
        // Simulating an amendment! The original hash was different.
        currentMockHash: "AMENDED_HASH_9999" 
    }
];

// Mock database to store last known hashes
const lastKnownHashes = {
    "Digital Personal Data Protection Act, 2023": "a1b2c3d4",
    "MahaRERA (Maharashtra Real Estate Regulatory Authority) Rules, 2017": "e5f6g7h8",
    "Karnataka Industrial Employment (Standing Orders) Rules, 1961": "OLD_HASH_1234"
};

/**
 * Simulates downloading a PDF from a government URL and returning its SHA-256 hash.
 */
async function fetchDocumentHash(url, mockHash) {
    // In production, this would be:
    // const response = await axios.get(url, { responseType: 'arraybuffer' });
    // return crypto.createHash('sha256').update(response.data).digest('hex');
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return mockHash;
}

async function runAmendmentChecker() {
    console.log("===============================================================");
    console.log("🏛️  LEXGUARD KNOWLEDGE BASE: AMENDMENT AUDITOR");
    console.log("   Checking State & Central portals for legislative changes...");
    console.log("===============================================================\n");

    await mongoose.connect(process.env.MONGODB_URI);
    
    let amendmentsFound = 0;

    for (const source of GOVERNMENT_PORTALS) {
        process.stdout.write(`[${source.jurisdiction}] Checking ${source.actName}... `);
        
        try {
            const liveHash = await fetchDocumentHash(source.url, source.currentMockHash);
            const knownHash = lastKnownHashes[source.actName];

            if (!knownHash) {
                console.log(`⚠️  NEW ACT DETECTED.`);
            } else if (liveHash !== knownHash) {
                console.log(`❌ AMENDMENT DETECTED! Hash mismatch (Old: ${knownHash}, New: ${liveHash})`);
                amendmentsFound++;
                
                // Alert the system that embeddings are stale
                console.log(`   -> Flagging all vectors for '${source.actName}' as STALE.`);
                
                // In production, we would trigger the Python ingestion pipeline here.
                // e.g., spawn('python3', ['train_setfit.py', '--reingest', source.actName]);
            } else {
                console.log(`✅ Verified (No changes).`);
            }
        } catch (err) {
            console.log(`🚨 Error connecting to portal: ${err.message}`);
        }
    }

    console.log("\n===============================================================");
    if (amendmentsFound > 0) {
        console.log(`🚨 AUDIT COMPLETE: ${amendmentsFound} legislative amendment(s) found.`);
        console.log(`   Action Required: Re-run ingestion pipeline for flagged acts.`);
    } else {
        console.log(`✅ AUDIT COMPLETE: Vector database is fully up-to-date.`);
    }
    console.log("===============================================================\n");

    await mongoose.connection.close();
}

runAmendmentChecker().catch(console.error);
