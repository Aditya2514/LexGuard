require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const StatuteNode = require('../src/models/StatuteNode');
const { generateLocalEmbedding } = require('./localEmbeddingService');

const COMPUTE_BATCH_SIZE = 5; 
const OPERATION_DELAY_MS = 500;

// Open-Source GitHub Repository containing cleanly parsed JSON formats of major Indian Laws
const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/civictech-India/Indian-Law-Penal-Code-Json/master/';

const ACTS_TO_INGEST = [
  { file: 'ipc.json', name: 'Indian Penal Code', domain: 'criminal_law' },
  { file: 'crpc.json', name: 'Code of Criminal Procedure', domain: 'criminal_law' },
  { file: 'cpc.json', name: 'Civil Procedure Code', domain: 'civil_law' },
  { file: 'iea.json', name: 'Indian Evidence Act', domain: 'general_contract_law' },
  { file: 'hma.json', name: 'Hindu Marriage Act', domain: 'family_law' }
];

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runGithubIngestion() {
  console.log("🌐 [GitHub Crawler] Initializing Open-Source Automated Ingestion...");
  
  if (!process.env.MONGODB_URI) {
    console.error("🚨 Missing MONGODB_URI entry.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("☁️ Connected to MongoDB Atlas.");

  let totalSectionsIngested = 0;

  for (const act of ACTS_TO_INGEST) {
    console.log(`\n=============================================================`);
    console.log(`📘 Downloading and Ingesting: ${act.name}`);
    console.log(`=============================================================`);

    try {
      // 1. Download the raw JSON file from GitHub directly into memory
      const response = await axios.get(`${GITHUB_BASE_URL}${act.file}`);
      const jsonSections = response.data; // Array of objects
      
      console.log(`🎯 Successfully downloaded ${jsonSections.length} sections for ${act.name}`);

      // 2. Loop through sections, embed locally, and push to Atlas
      for (let i = 0; i < jsonSections.length; i += COMPUTE_BATCH_SIZE) {
        const batch = jsonSections.slice(i, i + COMPUTE_BATCH_SIZE);
        
        const batchPromises = batch.map(async (sectionObj) => {
          try {
            // Map civictech JSON schema
            const secNum = `Section ${sectionObj.Section}`;
            const title = sectionObj.section_title || '';
            const desc = sectionObj.section_desc || '';
            
            const rawContent = `${title}\n${desc}`;
            if (rawContent.length < 10) return; // Skip empty nodes

            const contextPayloadText = `${act.name} ${secNum} ${title} ${desc}`;
            
            // Local offline CPU embedding
            const vectorCoordinates = await generateLocalEmbedding(contextPayloadText);
            
            // Sync up to Atlas
            await StatuteNode.findOneAndUpdate(
              { actName: act.name, sectionNumber: secNum },
              {
                actName: act.name,
                sectionNumber: secNum,
                content: rawContent,
                domain: act.domain,
                embedding: vectorCoordinates
              },
              { upsert: true, new: true }
            );

            console.log(`✅ [Synced] ${act.name} - ${secNum}`);
            totalSectionsIngested++;

          } catch (err) {
            console.error(`❌ [Failed] ${act.name} Section ${sectionObj.Section}:`, err.message);
          }
        });

        await Promise.all(batchPromises);
        await wait(OPERATION_DELAY_MS); // Prevent overwhelming local RAM
      }
      
    } catch (actErr) {
      console.error(`🚨 Failed to process ${act.name} from GitHub:`, actErr.message);
    }
  }

  console.log(`\n══ 🏆 AUTOMATED GITHUB INGESTION COMPLETE: ${totalSectionsIngested} SECTIONS SYNCED ══`);
  await mongoose.disconnect();
}

runGithubIngestion().catch(console.error);
