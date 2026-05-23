require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const StatuteNode = require('../src/models/StatuteNode');
const { generateLocalEmbedding } = require('./localEmbeddingService');

// Hardened Pacing Configurations to prevent IP/CAPTCHA lockouts from IndianKanoon
const SECTION_FETCH_DELAY_MS = 4000; // 4-second delay between section deep-dives
const ACT_FETCH_DELAY_MS = 8000;     // 8-second structural pause between distinct Acts

// Production Act Directory: Maps high-impact Central Acts to IndianKanoon unique document IDs
const TARGET_ACT_DIRECTORY = [
  {
    actName: "Information Technology Act, 2000",
    docId: "1905549", // Base document index for the IT Act on IndianKanoon
    domain: "data_privacy"
  },
  {
    actName: "Arbitration and Conciliation Act, 1996",
    docId: "1052228",
    domain: "general_contract_law"
  },
  {
    actName: "Consumer Protection Act, 2019",
    docId: "142106096",
    domain: "corporate_compliance"
  }
];

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Parses an Act's Table of Contents to extract section document hyperlinks
 */
async function crawlActTableOfContents(actDocId) {
  const url = `https://indiankanoon.org/doc/${actDocId}/`;
  console.log(`🌐 Fetching Act Directory Map: ${url}`);
  
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  
  const $ = cheerio.load(response.data);
  const sectionsFound = [];

  // Scrape and filter links matching IndianKanoon's section structure
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    
    // Check if the link text starts with a Section Number (e.g., "1.", "43A.")
    const isSectionNumber = /^\d+[A-Z]*\./.test(text);

    if (href && href.startsWith('/doc/') && isSectionNumber) {
      const sectionDocId = href.split('/')[2];
      if (sectionDocId !== actDocId) {
        sectionsFound.push({ sectionNumber: "Section " + text.split('.')[0], docId: sectionDocId });
      }
    }
  });

  // De-duplicate discovered section arrays to prevent redundant network runs
  return Array.from(new Set(sectionsFound.map(s => s.docId)))
    .map(id => sectionsFound.find(s => s.docId === id));
}

/**
 * Deep-scrapes a specific section page to isolate raw legislative text
 */
async function scrapeSectionContent(sectionDocId) {
  const url = `https://indiankanoon.org/doc/${sectionDocId}/`;
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  
  const $ = cheerio.load(response.data);
  
  // Target IndianKanoon's core text render container, stripping away search match fragments
  $('.holder').remove(); 
  let rawText = $('.judgments').text() || $('body').text();
  
  // Clean up excessive whitespace formatting and conversational artifacts
  return rawText.replace(/\s+/g, ' ').replace(/\[\s*🔍\s*\]/g, '').trim();
}

/**
 * Master Recursive Execution Gauntlet
 */
async function executeLiveMasterSpider() {
  console.log("🕷️ [Master Spider] Initializing Live Web-Scraping Compliance Gauntlet...");
  
  if (!process.env.MONGODB_URI) {
    console.error("🚨 Missing MONGODB_URI entry inside configuration parameters.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("☁️ Connected to Cloud Storage Cluster: MongoDB Atlas.");

  for (const act of TARGET_ACT_DIRECTORY) {
    try {
      console.log(`\n📘 Extracting Act Structure: ${act.actName}...`);
      const sectionLinks = await crawlActTableOfContents(act.docId);
      console.log(`🎯 Found ${sectionLinks.length} nested section blocks to ingest.`);

      for (const link of sectionLinks) {
        try {
          console.log(`\n⏳ Pacing delay active. Crawling Section Node: [${link.sectionNumber}] (ID: ${link.docId})`);
          await wait(SECTION_FETCH_DELAY_MS);

          const rawContent = await scrapeSectionContent(link.docId);
          if (!rawContent || rawContent.length < 30) continue;

          // Compute dense multi-dimensional mathematical embedding locally on your CPU
          const contextualTextPayload = `${act.actName} ${link.sectionNumber} ${rawContent}`;
          const coordinates = await generateLocalEmbedding(contextualTextPayload);

          // Idempotent cloud sync directly to Atlas
          await StatuteNode.findOneAndUpdate(
            { actName: act.actName, sectionNumber: link.sectionNumber },
            {
              actName: act.actName,
              sectionNumber: link.sectionNumber,
              content: rawContent,
              domain: act.domain,
              embedding: coordinates
            },
            { upsert: true, new: true }
          );
          console.log(`☁️ [Atlas Synced] Successfully persisted state for: ${link.sectionNumber}`);

        } catch (sectionErr) {
          console.error(`🚨 Error parsing section details for Node ID ${link.docId}:`, sectionErr.message);
        }
      }

      console.log(`🏁 Finished parsing Act: ${act.actName}. Structural cool-down active...`);
      await wait(ACT_FETCH_DELAY_MS);

    } catch (actErr) {
      console.error(`❌ Global collapse while crawling Act structure for ${act.actName}:`, actErr.message);
    }
  }

  console.log("\n══ 🏆 LIVE PRODUCTION INGESTION CYCLE COMPLETE ══");
  await mongoose.disconnect();
}

executeLiveMasterSpider().catch(console.error);
