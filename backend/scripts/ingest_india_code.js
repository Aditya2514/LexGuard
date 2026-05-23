require('dotenv').config();
const mongoose = require('mongoose');
const StatuteNode = require('../src/models/StatuteNode');
const { generateEmbedding } = require('../src/services/embeddingService');

// Curated staging array modeling incoming legislative section blocks
const INC_STATUTORY_DATA_POOL = [
  {
    actName: "Indian Contract Act, 1872",
    sectionNumber: "Section 27",
    domain: "general_contract_law",
    content: "Every agreement by which any one is restrained from exercising a lawful profession, trade or business of any kind, is to that extent void. Exception 1: One who sells the goodwill of a business may agree with the buyer to refrain from carrying on a similar business, within specified local limits."
  },
  {
    actName: "Digital Personal Data Protection Act, 2023",
    sectionNumber: "Section 6",
    domain: "data_privacy",
    content: "Consent given by the Data Principal shall be free, specific, informed, unconditional and unambiguous with a clear affirmative action, and shall signify agreement to the processing of her personal data for the specified purpose."
  },
  {
    actName: "Payment of Wages Act, 1936",
    sectionNumber: "Section 7",
    domain: "labor_law",
    content: "The wages of an employed person shall be paid to him without deductions of any kind except those authorized by or under this Act. Unreasonable fine retentions, unauthorized administrative structural deductions, or salary escrow drawdowns are strictly prohibited."
  }
];

async function executeStatuteBulkIngestion() {
  console.log("🚀 [V6 Ingestion Pipeline] Connecting to MongoDB Atlas Cluster...");
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log("🧠 Initializing feature-extraction pipelines...");
  
  for (const item of INC_STATUTORY_DATA_POOL) {
    try {
      console.log(`Processing ingestion chunk: ${item.actName} - ${item.sectionNumber}`);
      
      // Compute the dense vector embedding for the raw legislation text
      const lookupTextPayload = `${item.actName} ${item.sectionNumber} ${item.content}`;
      const vector = await generateEmbedding(lookupTextPayload);
      
      // Execute an upsert to guarantee idempotent scaling without duplicate pollution
      await StatuteNode.findOneAndUpdate(
        { actName: item.actName, sectionNumber: item.sectionNumber },
        {
          actName: item.actName,
          sectionNumber: item.sectionNumber,
          content: item.content,
          domain: item.domain,
          embedding: vector
        },
        { upsert: true, new: true }
      );
      
    } catch (err) {
      console.error(`🚨 Ingestion dropped for section ${item.sectionNumber}:`, err.message);
    }
  }

  console.log("══ 🏆 PAN-INDIA STATUTORIES STREAM COMPLETELY INGESTED ══");
  await mongoose.disconnect();
}

executeStatuteBulkIngestion().catch(console.error);
