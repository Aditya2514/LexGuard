require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const pdfParse = require('pdf-parse');
const StatuteNode = require('../src/models/StatuteNode');

// Ollama endpoints
const OLLAMA_URL = 'http://localhost:11434';
const EMBED_MODEL = 'nomic-embed-text';
const LLM_MODEL = 'llama3'; // or mistral

async function checkOllama() {
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`);
        if (!res.ok) throw new Error('Ollama not responding');
        const data = await res.json();
        const models = data.models.map(m => m.name);
        console.log("✅ Connected to local Ollama.");
        console.log("📦 Installed Models:", models);
        return models;
    } catch (err) {
        console.error("❌ Failed to connect to Ollama. Please ensure it is running at localhost:11434");
        process.exit(1);
    }
}

async function getOllamaEmbedding(text) {
    // Truncate massively long schedules to prevent context window crashes
    const safeText = text.length > 25000 ? text.substring(0, 25000) : text;

    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: EMBED_MODEL,
            prompt: safeText
        })
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to get embedding. Status: ${res.status}. Body: ${errText}`);
    }
    const data = await res.json();
    return data.embedding;
}

async function getHyDESummary(sectionText) {
    const prompt = `You are a legal expert. I will provide you with a section of an Indian Bare Act. Generate 5 highly realistic, modern corporate scenarios (like non-competes, NDA breaches, software disputes) where this specific law would be the deciding factor. Output ONLY the 5 scenarios as a plain text array.

Section Text:
${sectionText}`;

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: LLM_MODEL,
            prompt: prompt,
            stream: false,
            format: 'json'
        })
    });

    if (!res.ok) throw new Error("Failed to get summary");
    const data = await res.json();
    return data.response; // Plain text scenarios
}

async function processPdf(filePath) {
    const actName = path.basename(filePath, '.pdf').replace(/_/g, ' ');
    console.log(`\n📄 Processing: ${actName}`);

    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;

    // Simple State Machine
    // We split loosely by "Section X" or "CHAPTER Y"
    const lines = text.split('\n');

    let currentChapter = "Preliminary";
    let currentSection = null;
    let sectionBuffer = [];

    const chunks = [];

    for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned) continue;

        // Check for Chapter
        const chapterMatch = cleaned.match(/^CHAPTER\s+([A-Z0-9]+)/i);
        if (chapterMatch) {
            currentChapter = `Chapter ${chapterMatch[1]}`;
            continue;
        }

        // Check for Section
        // Matches "12. " or "Section 12"
        const sectionMatch = cleaned.match(/^(?:Section\s+)?(\d+[A-Z]?)\.\s+(.*)/i) || cleaned.match(/^(\d+[A-Z]?)\.\s+(.*)/);

        if (sectionMatch) {
            // Save previous section
            if (currentSection && sectionBuffer.length > 0) {
                chunks.push({
                    actName,
                    chapter: currentChapter,
                    sectionNumber: `Section ${currentSection}`,
                    content: sectionBuffer.join(' ')
                });
            }

            currentSection = sectionMatch[1];
            sectionBuffer = [sectionMatch[2]];
        } else {
            if (currentSection) {
                sectionBuffer.push(cleaned);
            }
        }
    }

    // Save last section
    if (currentSection && sectionBuffer.length > 0) {
        chunks.push({
            actName,
            chapter: currentChapter,
            sectionNumber: `Section ${currentSection}`,
            content: sectionBuffer.join(' ')
        });
    }

    console.log(`✂️  Extracted ${chunks.length} semantic sections from ${actName}.`);
    return chunks;
}

async function bulkIngest() {
    await checkOllama();

    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);

    const bareActsDir = path.join(__dirname, '../data/bare_acts');
    const files = fs.readdirSync(bareActsDir).filter(f => f.endsWith('.pdf'));

    console.log(`📂 Found ${files.length} PDFs to ingest.`);

    // Process all files
    const filesToProcess = files;

    for (const file of filesToProcess) {
        const filePath = path.join(bareActsDir, file);
        const sections = await processPdf(filePath);

        console.log(`\n🚀 Starting AI Enrichment & Vectorization for ${path.basename(file)}...`);

        let successCount = 0;
        // Process each section sequentially so we don't overload Ollama
        for (let i = 0; i < sections.length; i++) {
            const sec = sections[i];

            // 1. HyDE Enrichment (Llama 3)
            console.log(`   🧠 Generating Hypothetical Scenarios for ${sec.sectionNumber}...`);
            let hydeScenarios = "";
            try {
                // Truncate the text for Llama 3 generation to prevent context window blowouts
                const safeContext = sec.content.length > 5000 ? sec.content.substring(0, 5000) : sec.content;
                hydeScenarios = await getHyDESummary(safeContext);
            } catch (err) {
                console.error(`      ⚠️ HyDE generation failed: ${err.message}`);
            }

            // Concatenate raw text + Llama 3 generated modern scenarios
            const enrichedText = `${sec.content}\n\n[MODERN SCENARIOS]\n${hydeScenarios}`;

            try {
                // 2. Vectorization (Nomic Embed)
                const embedding = await getOllamaEmbedding(enrichedText);

                // 3. Upsert
                await StatuteNode.findOneAndUpdate(
                    { actName: sec.actName, sectionNumber: sec.sectionNumber },
                    {
                        actName: sec.actName,
                        sectionNumber: sec.sectionNumber,
                        content: enrichedText,
                        domain: sec.chapter, // Store chapter in domain field temporarily
                        embedding: embedding
                    },
                    { upsert: true, new: true }
                );
                successCount++;

                if (successCount % 10 === 0) {
                    console.log(`   ...Upserted ${successCount}/${sections.length} sections`);
                }
            } catch (err) {
                console.error(`   ⚠️ Failed to process ${sec.sectionNumber}: ${err.message}`);
            }
        }
        console.log(`✅ Completed ${path.basename(file)}: ${successCount} sections saved to Atlas.`);
    }

    console.log("🎉 Bulk Ingestion Complete!");
    process.exit(0);
}

bulkIngest().catch(err => {
    console.error("Critical Error:", err);
    process.exit(1);
});
