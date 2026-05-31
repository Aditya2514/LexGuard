require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const https = require('https');
const pdfParse = require('pdf-parse');
const { generateEmbedding } = require('../src/services/embeddingService');
const StatuteNode = require('../src/models/StatuteNode');
const { LAW_REFERENCES } = require('../src/config/lawReferences');

const DATA_DIR = path.join(__dirname, '../data/pdfs');

const axios = require('axios');

async function downloadFile(url, dest) {
  console.log(`Downloading ${url}...`);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const writer = fs.createWriteStream(dest);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function ingestCriminalCodes() {
    console.log("🚀 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);

    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const actsToIngest = ['BNS', 'BNSS', 'BSA'];

    for (const key of actsToIngest) {
        const ref = LAW_REFERENCES[key];
        const pdfPath = path.join(DATA_DIR, `${key}.pdf`);

        try {
            if (!fs.existsSync(pdfPath)) {
                await downloadFile(ref.reference_url, pdfPath);
            } else {
                console.log(`📄 ${key}.pdf already exists. Skipping download.`);
            }

            console.log(`Extracting text from ${key}.pdf...`);
            const dataBuffer = fs.readFileSync(pdfPath);
            const data = await pdfParse(dataBuffer);
            const text = data.text;

            // Simple heuristic to chunk by sections (e.g., "1.", "2.") or split by chapters
            // In a real production script, a robust parser for Indian bare acts should be used.
            const sections = text.split(/\n(?=\d+\.\s+[A-Z])/g).filter(s => s.trim().length > 50);
            
            console.log(`Found ~${sections.length} sections in ${ref.act_name}. Generating embeddings...`);
            
            let ingested = 0;
            for (let i = 0; i < sections.length; i++) {
                const sectionText = sections[i].trim();
                const sectionNumberMatch = sectionText.match(/^(\d+[A-Z]?)\./);
                const sectionNumber = sectionNumberMatch ? `Section ${sectionNumberMatch[1]}` : `Part ${i+1}`;

                // Check if exists
                const existing = await StatuteNode.findOne({ actName: ref.act_name, sectionNumber });
                if (existing) continue;

                const vector = await generateEmbedding(sectionText, 'search_document');
                if (vector && vector.length === 768) {
                    await StatuteNode.create({
                        actName: ref.act_name,
                        sectionNumber: sectionNumber,
                        content: sectionText,
                        domain: 'criminal_law',
                        jurisdiction: 'Central',
                        embedding: vector,
                        effectiveDate: new Date('2024-07-01')
                    });
                    ingested++;
                }
            }
            console.log(`✅ Ingested ${ingested} sections for ${ref.act_name}.`);
        } catch (err) {
            console.error(`🚨 Error processing ${key}:`, err.message);
        }
    }

    console.log("🎉 All criminal codes ingested successfully!");
    process.exit(0);
}

ingestCriminalCodes();
