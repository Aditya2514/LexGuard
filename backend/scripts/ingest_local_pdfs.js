require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const pdfParse = require('pdf-parse');
const StatuteNode = require('../src/models/StatuteNode');
const { generateLocalEmbedding } = require('./localEmbeddingService');

const PDF_DIRECTORY = path.join(__dirname, '../data/pdfs');
const BATCH_SIZE = 5;
const DELAY_MS = 1000;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extracts and splits PDF text into sections
 */
async function processPdfFile(filePath, actName, domain) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  
  const rawText = data.text;
  
  // Basic heuristic: Split by "Section " or "Sec. " or numbered titles
  // This Regex tries to find "1. " or "Section 1" pattern to chunk the text.
  // Note: Depending on the PDF formatting, this might need tweaking.
  const sectionChunks = rawText.split(/(?=Section\s+\d+|^\d+\.\s+[A-Z])/gm);
  
  console.log(`📑 [Parsed] ${actName}: Found ~${sectionChunks.length} potential sections in PDF.`);
  
  const formattedSections = sectionChunks.map((chunk, index) => {
    // Attempt to extract the section number
    const match = chunk.match(/(?:Section\s+|^\s*)(\d+[A-Z]*)/i);
    const sectionNum = match ? `Section ${match[1]} (Chunk ${index + 1})` : `Part ${index + 1}`;
    
    // Clean up text
    const content = chunk.replace(/\s+/g, ' ').trim();
    return { sectionNumber: sectionNum, content };
  }).filter(s => s.content.length > 50); // Filter out tiny chunks like headers
  
  return formattedSections;
}

/**
 * Local PDF Ingestion Engine
 */
async function runPdfIngestion() {
  console.log("📂 [Offline PDF Spider] Initializing Local Ingestion Gauntlet...");
  
  if (!process.env.MONGODB_URI) {
    console.error("🚨 Missing MONGODB_URI entry inside configuration parameters.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("☁️ Connected to MongoDB Atlas.");

  if (!fs.existsSync(PDF_DIRECTORY)) {
    fs.mkdirSync(PDF_DIRECTORY, { recursive: true });
    console.log(`📁 Created directory: ${PDF_DIRECTORY}. Please place your PDFs here.`);
    process.exit(0);
  }

  const files = fs.readdirSync(PDF_DIRECTORY).filter(f => f.endsWith('.pdf'));
  
  if (files.length === 0) {
    console.log(`⚠️ No PDFs found in ${PDF_DIRECTORY}. Please download Bare Acts from indiacode.nic.in and place them here.`);
    process.exit(0);
  }

  for (const file of files) {
    const actName = file.replace('.pdf', '').replace(/_/g, ' ');
    // Default domain, can be updated later in the DB
    const domain = "general_contract_law"; 
    
    console.log(`\n=============================================================`);
    console.log(`📘 Ingesting Local PDF Act: ${actName}`);
    console.log(`=============================================================`);

    try {
      const filePath = path.join(PDF_DIRECTORY, file);
      const sections = await processPdfFile(filePath, actName, domain);
      
      let totalIngested = 0;

      for (let i = 0; i < sections.length; i += BATCH_SIZE) {
        const batch = sections.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (section) => {
          try {
            const contextPayload = `${actName} ${section.sectionNumber} ${section.content}`;
            const vectorCoordinates = await generateLocalEmbedding(contextPayload);
            
            await StatuteNode.findOneAndUpdate(
              { actName: actName, sectionNumber: section.sectionNumber },
              {
                actName: actName,
                sectionNumber: section.sectionNumber,
                content: section.content,
                domain: domain,
                embedding: vectorCoordinates
              },
              { upsert: true, new: true }
            );
            totalIngested++;
            console.log(`✅ [Synced] ${actName} - ${section.sectionNumber}`);
          } catch (err) {
            console.error(`❌ [Failed] ${section.sectionNumber}: ${err.message}`);
          }
        });

        await Promise.all(batchPromises);
        await wait(DELAY_MS);
      }
      
      console.log(`🏁 Finished processing ${file}. Total Sections: ${totalIngested}`);
    } catch (error) {
      console.error(`🚨 Failed to process ${file}:`, error.message);
    }
  }

  console.log("\n══ 🏆 LOCAL OFFLINE PDF INGESTION COMPLETE ══");
  await mongoose.disconnect();
}

runPdfIngestion().catch(console.error);
