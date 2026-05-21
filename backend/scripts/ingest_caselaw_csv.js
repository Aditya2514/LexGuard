require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const CaseLaw = require('../src/models/CaseLaw');
const { getEmbedding } = require('../src/services/lawRetrieverService');
const { upsertCaseLaw } = require('../src/services/pineconeClient');

// CSV Format Expected:
// caseName, citation, court, summary, holdings

async function ingestCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`CSV file not found at ${filePath}`);
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(process.env.MONGODB_URI);

  const results = [];
  
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.log(`Parsed ${results.length} rows. Beginning ingestion...`);

      for (let i = 0; i < results.length; i++) {
        const row = results[i];
        
        if (!row.caseName || !row.citation) {
          console.warn(`Row ${i + 1} skipped: missing caseName or citation.`);
          continue;
        }

        console.log(`Processing [${i + 1}/${results.length}]: ${row.caseName}`);
        
        try {
          const pineconeId = `caselaw_${row.citation.replace(/[^a-zA-Z0-9]/g, '_')}`;

          const existing = await CaseLaw.findOne({ citation: row.citation });
          if (existing) {
            console.log(`  -> Case already exists in MongoDB, skipping.`);
            continue;
          }

          const combinedText = `${row.caseName}\nCitation: ${row.citation}\nCourt: ${row.court}\nSummary: ${row.summary}\nHoldings: ${row.holdings}`;
          const vector = await getEmbedding(combinedText);

          if (!vector) {
             console.error(`  -> Failed to generate embedding for ${row.caseName}`);
             continue;
          }

          // 1. Save to MongoDB
          await CaseLaw.create({
            caseName: row.caseName,
            citation: row.citation,
            court: row.court,
            summary: row.summary,
            holdings: row.holdings ? [row.holdings] : [], // Wrap in array to match schema
            referenceUrl: row.referenceUrl || 'https://main.sci.gov.in/judgments/'
          });

          // 2. Upsert to Pinecone
          await upsertCaseLaw(pineconeId, vector, {
            caseName: row.caseName,
            citation: row.citation,
            court: row.court,
            summary: row.summary,
            holdings: row.holdings || '',
            referenceUrl: row.referenceUrl || 'https://main.sci.gov.in/judgments/'
          });

          console.log(`  -> Successfully ingested!`);

        } catch (err) {
          console.error(`  -> Error processing ${row.caseName}:`, err.message);
        }
      }

      console.log('✅ CSV Ingestion Complete!');
      process.exit(0);
    });
}

const targetFile = process.argv[2];
if (!targetFile) {
  console.log('Usage: node ingest_caselaw_csv.js <path-to-csv>');
  process.exit(1);
}

ingestCSV(targetFile);
