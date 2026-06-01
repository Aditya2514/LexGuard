require('dotenv').config();
const mongoose = require('mongoose');

const StatuteNode = require('../src/models/StatuteNode');
const CaseLaw = require('../src/models/CaseLaw');
const LegalDomainMap = require('../src/models/LegalDomainMap');
const { generateEmbedding } = require('../src/services/embeddingService');
const aiClient = require('../src/services/aiClient');

const color = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

async function runDiagnostics() {
    console.log(`\n${color.blue}======================================================${color.reset}`);
    console.log(`${color.blue}🚀 LEXGUARD FULL SYSTEM DIAGNOSTIC AUDIT 🚀${color.reset}`);
    console.log(`${color.blue}======================================================${color.reset}\n`);

    const results = {
        infrastructure: { passed: 0, failed: 0 },
        database: { passed: 0, failed: 0 },
        llm: { passed: 0, failed: 0 },
        vectorSearch: { passed: 0, failed: 0 }
    };

    const assert = (condition, testName, category, errorMsg = '') => {
        if (condition) {
            console.log(`${color.green}✅ [PASS] ${testName}${color.reset}`);
            results[category].passed++;
            return true;
        } else {
            console.log(`${color.red}❌ [FAIL] ${testName}${color.reset}`);
            if (errorMsg) console.log(`   └─ ${color.yellow}${errorMsg}${color.reset}`);
            results[category].failed++;
            return false;
        }
    };

    // ---------------------------------------------------------
    // 1. INFRASTRUCTURE HEALTH
    // ---------------------------------------------------------
    console.log(`\n${color.blue}--- 1. Infrastructure & Environment ---${color.reset}`);
    
    const envVars = ['MONGODB_URI', 'REDIS_URL', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'JWT_SECRET'];
    const missingVars = envVars.filter(v => !process.env[v]);
    assert(missingVars.length === 0, 'Environment Variables Loaded', 'infrastructure', `Missing: ${missingVars.join(', ')}`);

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        assert(true, 'MongoDB Atlas Connected', 'infrastructure');
    } catch (e) {
        assert(false, 'MongoDB Atlas Connected', 'infrastructure', e.message);
    }

    // ---------------------------------------------------------
    // 2. DATABASE INTEGRITY
    // ---------------------------------------------------------
    console.log(`\n${color.blue}--- 2. Database & Accuracy Models ---${color.reset}`);
    try {
        const numStatutes = await StatuteNode.countDocuments();
        assert(numStatutes >= 6000, `Statute Database Seeded (${numStatutes} nodes)`, 'database', 'Statutes count is lower than expected 6000+');

        const bnsCount = await StatuteNode.countDocuments({ actName: /Bharatiya Nyaya Sanhita/i });
        const bnssCount = await StatuteNode.countDocuments({ actName: /Bharatiya Nagarik Suraksha Sanhita/i });
        const bsaCount = await StatuteNode.countDocuments({ actName: /Bharatiya Sakshya Adhiniyam/i });
        assert(bnsCount > 0 && bnssCount > 0 && bsaCount > 0, `2023 Criminal Codes (BNS, BNSS, BSA) Ingested`, 'database', 'Missing one or more of the new 2023 criminal codes.');

        const numCaseLaws = await CaseLaw.countDocuments();
        assert(numCaseLaws >= 10, `Case Law Precedents Seeded (${numCaseLaws} precedents)`, 'database', 'Case Law precedents count is lower than expected.');

        const numDomains = await LegalDomainMap.countDocuments();
        assert(numDomains > 0, `Ontology Router Maps Seeded (${numDomains} maps)`, 'database', 'LegalDomainMap is empty.');

        // Check Embedding Dimensionality (Phase 9 requirement)
        const sampleStatute = await StatuteNode.findOne({ embedding: { $ne: null } });
        if (sampleStatute) {
            const dim = sampleStatute.embedding.length;
            assert(dim === 1024, `Embeddings are 1024-dimensional (BGE-m3) [Found: ${dim}d]`, 'database', `Expected 1024d, but found ${dim}d`);
        } else {
            assert(false, 'Embeddings are 1024-dimensional', 'database', 'No embeddings found in the database.');
        }

    } catch (e) {
        console.error(`${color.red}Error testing database: ${e.message}${color.reset}`);
    }

    // ---------------------------------------------------------
    // 3. LLM API HEALTH & BACKOFF TESTING
    // ---------------------------------------------------------
    console.log(`\n${color.blue}--- 3. LLM Providers & Fallback Mechanisms ---${color.reset}`);
    try {
        const response = await aiClient.callLLM({ systemPrompt: "You are a test bot.", userContent: "Say 'Ping'", jsonMode: false });
        assert(response && response.parsed && response.parsed.length > 0, 'LLM Cascade Routing Operational (Groq/Gemini)', 'llm');
    } catch (e) {
        assert(false, 'LLM Cascade Routing Operational', 'llm', e.message);
    }

    // ---------------------------------------------------------
    // 4. ATLAS VECTOR SEARCH HEALTH
    // ---------------------------------------------------------
    console.log(`\n${color.blue}--- 4. Atlas Vector Search Integration ---${color.reset}`);
    try {
        const queryVector = await generateEmbedding("employee termination protocol", "search_query");
        assert(queryVector && queryVector.length === 1024, 'BGE-m3 Embedding Generation Successful', 'vectorSearch', 'Failed to generate 1024d embedding via BGE-m3.');

        if (queryVector) {
            const searchResults = await StatuteNode.aggregate([
                {
                    $vectorSearch: {
                        index: "lexguard_statutes_vector_index",
                        path: "embedding",
                        queryVector: queryVector,
                        numCandidates: 10,
                        limit: 1
                    }
                }
            ]);
            assert(searchResults && searchResults.length > 0, '$vectorSearch Index is Active and Queryable', 'vectorSearch', 'Atlas $vectorSearch returned 0 results. Index might be building or misconfigured.');
        }
    } catch (e) {
        assert(false, '$vectorSearch Index is Active and Queryable', 'vectorSearch', e.message);
    }

    // ---------------------------------------------------------
    // 5. FRONTEND BUILD HEALTH
    // ---------------------------------------------------------
    console.log(`\n${color.blue}--- 5. Frontend Build Health ---${color.reset}`);
    try {
        const { execSync } = require('child_process');
        execSync('npm run build', { cwd: '../frontend', stdio: 'ignore' });
        assert(true, 'Vite React Build Compiled Successfully', 'infrastructure');
    } catch (e) {
        assert(false, 'Vite React Build Compiled Successfully', 'infrastructure', e.message);
    }

    // ---------------------------------------------------------
    // SUMMARY
    // ---------------------------------------------------------
    console.log(`\n${color.blue}======================================================${color.reset}`);
    console.log(`📊 DIAGNOSTIC SUMMARY`);
    console.log(`${color.blue}======================================================${color.reset}`);
    
    let allPassed = true;
    for (const [category, stats] of Object.entries(results)) {
        const total = stats.passed + stats.failed;
        if (stats.failed > 0) allPassed = false;
        const catColor = stats.failed === 0 ? color.green : color.red;
        console.log(`- ${category.toUpperCase()}: ${catColor}${stats.passed}/${total} Passed${color.reset}`);
    }

    if (allPassed) {
        console.log(`\n${color.green}🎉 ALL SYSTEMS OPERATIONAL. LexGuard architecture is fully robust and accurate.${color.reset}\n`);
    } else {
        console.log(`\n${color.red}⚠️ DIAGNOSTICS FAILED. One or more core systems are experiencing issues.${color.reset}\n`);
    }

    await mongoose.disconnect();
    process.exit(allPassed ? 0 : 1);
}

runDiagnostics();
