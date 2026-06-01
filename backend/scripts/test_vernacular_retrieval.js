const embeddingService = require('../src/services/embeddingService');

// Helper to compute Cosine Similarity between two arrays
function cosineSimilarity(vecA, vecB) {
  return vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
}

async function runVernacularTest() {
  console.log("Loading Xenova/bge-m3 (1024d) into memory...");
  
  const query = "What is the penalty for unfair termination of an employee?";
  
  const englishStatute = "An employer who terminates an employee without just cause shall be liable for penalty.";
  const hindiStatute = "बिना उचित कारण के किसी कर्मचारी को नौकरी से निकालने वाले नियोक्ता पर जुर्माना लगाया जाएगा।"; // Exact translation
  const unrelatedHindi = "यह अनुबंध केवल महाराष्ट्र राज्य में संपत्तियों के पट्टे पर लागू होता है।"; // Unrelated property lease

  console.log("Generating embeddings...");
  const vecQuery = await embeddingService.generateEmbedding(query);
  const vecEng = await embeddingService.generateEmbedding(englishStatute);
  const vecHindi = await embeddingService.generateEmbedding(hindiStatute);
  const vecUnrelated = await embeddingService.generateEmbedding(unrelatedHindi);

  console.log("\n--- BGE-m3 Cross-Lingual Semantic Match Results ---");
  console.log(`Query <-> English Law: ${(cosineSimilarity(vecQuery, vecEng)).toFixed(3)}`);
  console.log(`Query <-> Hindi Law:   ${(cosineSimilarity(vecQuery, vecHindi)).toFixed(3)}`);
  console.log(`Query <-> Unrelated Hindi: ${(cosineSimilarity(vecQuery, vecUnrelated)).toFixed(3)}`);
  
  if (cosineSimilarity(vecQuery, vecHindi) > 0.75) {
    console.log("\n✅ SUCCESS: BGE-m3 successfully maps English queries to Hindi text natively!");
  }
}

runVernacularTest().catch(console.error);
