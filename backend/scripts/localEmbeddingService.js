const { pipeline, env } = require('@xenova/transformers');

// Prevent caching to external remote locations, enforce local model storage in the project directory
env.cacheDir = './.cache/transformers';
env.allowRemoteModels = true; // allow downloading the model on first run

let extractorPipeline = null;

/**
 * Initializes and returns the embedding pipeline singleton.
 */
async function getExtractor() {
  if (!extractorPipeline) {
    console.log("⬇️ [Transformers.js] Booting 'all-MiniLM-L6-v2' ONNX model into local RAM... (This may take a moment on first run)");
    extractorPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true, // Uses int8 quantization for ultra-fast local CPU inference (~22MB)
    });
    console.log("✅ [Transformers.js] Local Model successfully loaded!");
  }
  return extractorPipeline;
}

/**
 * Generates a 384-dimensional vector embedding entirely locally without hitting any API.
 * @param {string} text - The input text to embed
 * @returns {number[]} Array of 384 numbers
 */
async function generateLocalEmbedding(text) {
  try {
    const extractor = await getExtractor();
    
    // pooling="mean" and normalize=true exactly match the Hugging Face API output format
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    
    // convert the Float32Array to a standard JavaScript array
    return Array.from(output.data);
  } catch (error) {
    console.error("🚨 [LocalEmbedding] Generation Failed:", error);
    throw error;
  }
}

module.exports = { generateLocalEmbedding };
