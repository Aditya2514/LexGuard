require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const pdfParse = require('pdf-parse');
const StatuteNode = require('../src/models/StatuteNode');
const { generateEmbedding } = require('../src/services/embeddingService');

const BARE_ACTS_DIR = path.join(__dirname, '../data/bare_acts');
const BATCH_SIZE = 10;

// Domain mapping based on bare act filename/name (lowercase match)
function getDomainForAct(actNameLower) {
  if (actNameLower.includes('wages') || 
      actNameLower.includes('industrial disputes') || 
      actNameLower.includes('industrial relations') || 
      actNameLower.includes('maternity benefit') || 
      actNameLower.includes('sexual harassment') || 
      actNameLower.includes('epfscheme')) {
    return 'labor_law';
  }
  if (actNameLower.includes('digital personal data') || 
      actNameLower.includes('intermediary guidelines') || 
      actNameLower.includes('it rules') || 
      actNameLower.includes('it act') || 
      actNameLower.includes('cert-in') || 
      actNameLower.includes('telecommunications')) {
    return 'data_privacy';
  }
  if (actNameLower.includes('copyright') || 
      actNameLower.includes('trade marks') || 
      actNameLower.includes('patents') || 
      actNameLower.includes('spacepolicy')) {
    return 'intellectual_property';
  }
  if (actNameLower.includes('real estate') || 
      actNameLower.includes('transfer of property') || 
      actNameLower.includes('transferofproperty')) {
    return 'real_estate_law';
  }
  if (actNameLower.includes('consumer protection')) {
    return 'consumer_protection';
  }
  if (actNameLower.includes('specific relief') || actNameLower.includes('dispute')) {
    return 'dispute_resolution';
  }
  // Default for others
  return 'general_contract_law';
}

async function processPdfFile(filePath, actName, domain) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  const rawText = data.text;
  
  // Split by "Section X" or numbered titles (e.g., "12. " at start of line)
  const sectionChunks = rawText.split(/(?=Section\s+\d+|^\d+\.\s+[A-Z])/gm);
  
  console.log(`📑 [Parsed] ${actName}: Found ~${sectionChunks.length} potential sections in PDF.`);
  
  const formattedSections = sectionChunks.map((chunk, index) => {
    // Attempt to extract the section number
    const match = chunk.match(/(?:Section\s+|^\s*)(\d+[A-Z]*)/i);
    const sectionNum = match ? `Section ${match[1]}` : `Part ${index + 1}`;
    
    // Clean up text
    const content = chunk.replace(/\s+/g, ' ').trim();
    return { sectionNumber: sectionNum, content };
  }).filter(s => s.content.length > 50); // Filter out tiny chunks
  
  return formattedSections;
}

async function reingest() {
  console.log("🚀 Starting Statute Re-ingestion & Embedding Generation (1024-dim BGE-M3)...");
  
  if (!process.env.MONGODB_URI) {
    console.error("🚨 Missing MONGODB_URI entry inside configuration parameters.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("☁️ Connected to MongoDB Atlas.");

  // Clear existing Statutes collection
  console.log("🧹 Clearing statutes collection...");
  await StatuteNode.deleteMany({});
  console.log("🧹 Collection cleared.");

  if (!fs.existsSync(BARE_ACTS_DIR)) {
    console.error(`🚨 Bare acts directory not found: ${BARE_ACTS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(BARE_ACTS_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`📂 Found ${files.length} PDFs in bare_acts.`);

  // To prevent token explosion and rate limits, we limit concurrency using simple batches
  for (const file of files) {
    const actNameRaw = file.replace('.pdf', '').replace(/_/g, ' ');
    const domain = getDomainForAct(actNameRaw.toLowerCase());
    
    console.log(`\n📘 Processing file: ${file} ➔ Domain: ${domain}`);
    const filePath = path.join(BARE_ACTS_DIR, file);
    
    try {
      const sections = await processPdfFile(filePath, actNameRaw, domain);
      console.log(`⚡ Generating embeddings for ${sections.length} sections...`);
      
      let ingestedCount = 0;
      for (let i = 0; i < sections.length; i += BATCH_SIZE) {
        const batch = sections.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (sec) => {
          try {
            // Context text to embed
            const embedText = `${actNameRaw} ${sec.sectionNumber} ${sec.content}`;
            const embedding = await generateEmbedding(embedText, 'search_document');
            
            await StatuteNode.findOneAndUpdate(
              { actName: actNameRaw, sectionNumber: sec.sectionNumber },
              {
                actName: actNameRaw,
                sectionNumber: sec.sectionNumber,
                content: sec.content,
                domain: domain,
                embedding: embedding,
                jurisdiction: "Central",
                isRepealed: false
              },
              { upsert: true, new: true }
            );
            ingestedCount++;
          } catch (err) {
            // Silently ignore or log specific errors
            if (!err.message.includes('duplicate key')) {
              console.error(`   ⚠️ Failed to ingest ${sec.sectionNumber}: ${err.message}`);
            }
          }
        });
        
        await Promise.all(promises);
        if (ingestedCount % 50 === 0 || ingestedCount === sections.length) {
          console.log(`   Processed ${ingestedCount}/${sections.length} sections...`);
        }
      }
      console.log(`✅ Completed ${file}: Ingested ${ingestedCount} sections.`);
    } catch (err) {
      console.error(`🚨 Failed to process act ${file}:`, err.message);
    }
  }

  console.log("\n══ 🏆 Statutes Re-ingestion Complete! ══");
  
  // Call normalization to canonicalize the names
  console.log("🔄 Running normalization script on newly ingested statutes...");
  const { execSync } = require('child_process');
  try {
    execSync('node scripts/normalize_statutes.js', { stdio: 'inherit' });
    console.log("✅ Normalization complete.");
  } catch (err) {
    console.error("❌ Normalization script failed:", err.message);
  }

  await mongoose.disconnect();
}

reingest().catch(console.error);
