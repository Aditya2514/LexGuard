require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const StatuteNode = require('../src/models/StatuteNode');
const { generateLocalEmbedding } = require('./localEmbeddingService');

/**
 * 🕷️ India Code Spider (Pilot: IT Act 2000)
 * This script crawls a target URL, extracts text, chunks it by "Section",
 * generates 0-cost local CPU embeddings, and syncs directly to MongoDB Atlas.
 */

async function runSpider() {
  console.log("🚀 [India Code Spider] Connecting to MongoDB Atlas Cloud...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ [India Code Spider] Database connected.");

  // For the pilot, we simulate fetching a massive block of the IT Act 2000.
  // In a full run, this would be an axios.get() inside a recursive crawler loop.
  console.log("🕸️ [India Code Spider] Scraping target text for Information Technology Act, 2000...");
  
  // Simulated scraped text payload
  const scrapedText = `
Section 43: Penalty and compensation for damage to computer, computer system, etc.
If any person without permission of the owner or any other person who is in charge of a computer, computer system or computer network, accesses or secures access to such computer, computer system or computer network or computer resource, he shall be liable to pay damages by way of compensation to the person so affected.

Section 43A: Compensation for failure to protect data.
Where a body corporate, possessing, dealing or handling any sensitive personal data or information in a computer resource which it owns, controls or operates, is negligent in implementing and maintaining reasonable security practices and procedures and thereby causes wrongful loss or wrongful gain to any person, such body corporate shall be liable to pay damages by way of compensation to the person so affected.

Section 66: Computer related offences.
If any person, dishonestly or fraudulently, does any act referred to in section 43, he shall be punishable with imprisonment for a term which may extend to three years or with fine which may extend to five lakh rupees or with both.
  `;

  // 1. CHUNK: Use RegEx to split the massive text into individual Section documents
  console.log("✂️ [India Code Spider] Chunking scraped text by statutory sections...");
  
  // Split by "Section [number]:"
  const sectionRegex = /(Section \d+[A-Z]*:.*?)(?=\nSection \d+[A-Z]*:|$)/gs;
  let match;
  const chunks = [];

  while ((match = sectionRegex.exec(scrapedText)) !== null) {
    const rawChunk = match[1].trim();
    const sectionMatch = rawChunk.match(/^(Section \d+[A-Z]*):/);
    if (sectionMatch) {
      chunks.push({
        actName: "Information Technology Act, 2000",
        sectionNumber: sectionMatch[1],
        domain: "data_privacy", // Taxonomy tag
        content: rawChunk.replace(/^(Section \d+[A-Z]*):\s*/, '').trim()
      });
    }
  }

  console.log(`📊 [India Code Spider] Successfully extracted ${chunks.length} sections.`);

  // 2. EMBED & SYNC: Loop through chunks, embed locally, push to cloud
  for (const chunk of chunks) {
    try {
      console.log(`\n⚙️ Processing: ${chunk.sectionNumber}`);
      
      const textToEmbed = `${chunk.actName} ${chunk.sectionNumber} ${chunk.content}`;
      
      // Zero-cost local CPU embedding!
      const vector = await generateLocalEmbedding(textToEmbed);
      
      console.log(`☁️ Syncing vector (${vector.length} dimensions) to MongoDB Atlas...`);
      
      await StatuteNode.findOneAndUpdate(
        { actName: chunk.actName, sectionNumber: chunk.sectionNumber },
        {
          actName: chunk.actName,
          sectionNumber: chunk.sectionNumber,
          content: chunk.content,
          domain: chunk.domain,
          embedding: vector
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Synced: ${chunk.sectionNumber}`);
      
    } catch (err) {
      console.error(`🚨 Failed to process ${chunk.sectionNumber}:`, err.message);
    }
  }

  console.log("\n══ 🏆 PILOT INGESTION COMPLETE ══");
  await mongoose.disconnect();
}

runSpider().catch(console.error);
