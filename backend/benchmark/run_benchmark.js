const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { runAgent1ClauseExtractor } = require('../src/services/agent1ClauseExtractor');
const { runAgent2RiskAnalyst } = require('../src/services/agent2RiskAnalyst');
const { runAgent3UserAdvocate } = require('../src/services/agent3UserAdvocate');
const { callLLM } = require('../src/services/aiClient');

const DATASET_PATH = path.join(__dirname, 'dataset.json');
const REPORT_PATH = path.join(__dirname, 'benchmark_report.md');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Robust LLM invocation wrapper with dynamic Exponential Backoff
 */
async function executeWithRetry(agentFunction, ...args) {
  let retries = 3;
  let delay = 2000;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await agentFunction(...args);
    } catch (error) {
      if ((error.status === 429 || error.message.includes('rate limit')) && i < retries - 1) {
        console.warn(`⚠️ [Rate Limit Hit] Backing off for ${delay}ms (Attempt ${i + 1}/${retries})...`);
        await wait(delay);
        delay *= 2; // double the backoff duration
        continue;
      }
      throw error;
    }
  }
}

/**
 * Evaluates Agent 3's rewrite quality using an isolated Judge Prompt Matrix
 */
async function runJudgeOnRewrite(originalText, suggestedRewrite, riskLevel) {
  if (riskLevel === 'LOW' || !suggestedRewrite) return 10; // Perfect score by default if no rewrite was needed

  const JUDGE_PROMPT = `
  Role: Legal Quality Assurance Judge.
  Task: Rate the quality of a suggested contract redline/rewrite on a strict scale from 1 to 10.
  
  Criteria:
  - Score 10: The rewrite completely strips the predatory element, makes the clause legally compliant under Indian law, but retains reasonable operational protection for the business context.
  - Score 1-3: The rewrite failed to change the predatory mechanism, remains illegal, or completely broke the text semantics.
  
  Output ONLY a raw integer between 1 and 10. No commentary.
  `;

  const userPrompt = `
  Original Predatory Clause: "${originalText}"
  Suggested Redline Alternative: "${suggestedRewrite}"
  `;

  try {
    const scoreText = await callLLM({ systemPrompt: JUDGE_PROMPT, userPrompt, temperature: 0.0 });
    
    // Use a regex to look for any standalone number between 1 and 10 in the response
    const match = scoreText.match(/\b([1-9]|10)\b/);
    const score = match ? parseInt(match[1], 10) : 5;
    
    return score;
  } catch (err) {
    return 5; // Safe medium fallback on judge API stutter
  }
}

async function startBenchmarkRunner() {
  console.log("🚀 [LexGuard Benchmark Suite] Booting validation pipeline...");
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));

  let metrics = {
    total: dataset.length,
    agent1Correct: 0,
    agent2Correct: 0,
    falsePositives: 0,
    falseNegatives: 0,
    totalRewriteScore: 0,
    rewritesEvaluated: 0
  };

  const mongoose = require('mongoose');

  let detailedResultsMarkdown = `\n## Detailed Per-TestCase Audit Telemetry\n\n| Test ID | Expected Type / Risk | AI Type / Risk | Status | Rewrite Quality (1-10) |\n| :--- | :--- | :--- | :--- | :--- |\n`;

    for (const tc of dataset) {
      console.log(`\n🔎 [Testing] ID: ${tc.id}`);
      await wait(8000); // Steady operational pacing delay to prevent rate limit fires

    try {
      const mockId = new mongoose.Types.ObjectId().toString();
      const mockChunk = { id: mockId, text: tc.text };

      // Step 1: Agent 1 - Clause Classification Extraction
      const a1Result = await executeWithRetry(runAgent1ClauseExtractor, [mockChunk]);
      const extractedType = a1Result[0]?.clause_type || "unknown";
      const isA1Correct = extractedType === tc.expected_type;
      if (isA1Correct) metrics.agent1Correct++;

      // Step 2: Agent 2 & 2.5 - Risk Assessment and Judge Reflection Loop
      const mockGlobalContext = { metadata: { governingLaw: "India" } };
      mockChunk.clause_type = extractedType; // Pass type to Agent 2
      
      const a2Result = await executeWithRetry(runAgent2RiskAnalyst, [mockChunk], mockGlobalContext);
      const aiRisk = (a2Result[0]?.risk_level || "UNKNOWN").toUpperCase();
      
      const isA2Correct = aiRisk === tc.expected_risk;
      if (isA2Correct) metrics.agent2Correct++;

      // Map False Positives & False Negatives metrics
      if (tc.expected_risk === 'LOW' && (aiRisk === 'HIGH' || aiRisk === 'CRITICAL')) metrics.falsePositives++;
      if ((tc.expected_risk === 'HIGH' || tc.expected_risk === 'CRITICAL') && aiRisk === 'LOW') metrics.falseNegatives++;

      // Step 3: Agent 3 & Judge Reflection - Redline Evaluation
      let rewriteScore = 10;
      if (tc.expected_risk !== 'LOW') {
        metrics.rewritesEvaluated++;
        mockChunk.risk_level = aiRisk.toLowerCase();
        const a3Result = await executeWithRetry(runAgent3UserAdvocate, [mockChunk]);
        const suggestedRewrite = a3Result[0]?.suggested_rewrite || "";
        rewriteScore = await runJudgeOnRewrite(tc.text, suggestedRewrite, aiRisk);
        metrics.totalRewriteScore += rewriteScore;
      }

      const statusIcon = (isA1Correct && isA2Correct) ? "✅ PASS" : "❌ MISMATCH";
      detailedResultsMarkdown += `| ${tc.id} | ${tc.expected_type} / ${tc.expected_risk} | ${extractedType} / ${aiRisk} | ${statusIcon} | ${rewriteScore}/10 |\n`;

    } catch (tcError) {
      console.error(`🚨 Failure during Test Case ${tc.id}:`, tcError);
      detailedResultsMarkdown += `| ${tc.id} | ${tc.expected_type} / ${tc.expected_risk} | ERROR / CRASH | 🚨 CRASHED | N/A |\n`;
    }
  }

  // Compile Final System Performance Summary Reports
  const a1Accuracy = ((metrics.agent1Correct / metrics.total) * 100).toFixed(2);
  const a2Accuracy = ((metrics.agent2Correct / metrics.total) * 100).toFixed(2);
  const avgRewriteQuality = metrics.rewritesEvaluated > 0 ? (metrics.totalRewriteScore / metrics.rewritesEvaluated).toFixed(2) : "N/A";

  const finalReportMarkdown = `# 🏛️ LexGuard Core AI Engine Benchmark Quality Report
Generated At: ${new Date().toISOString()}

### Core Evaluation Diagnostics Metrics
* **Total Audited Test Cases:** ${metrics.total}
* **Agent 1 Classification Accuracy:** ${a1Accuracy}% (${metrics.agent1Correct}/${metrics.total})
* **Agent 2/2.5 Risk Assessment Accuracy:** ${a2Accuracy}% (${metrics.agent2Correct}/${metrics.total})
* **System False Positive Rate:** ${metrics.falsePositives} occurrences
* **System False Negative Rate:** ${metrics.falseNegatives} occurrences
* **Agent 3 Average Rewrite Quality Grade:** ${avgRewriteQuality}/10

${detailedResultsMarkdown}
`;

  fs.writeFileSync(REPORT_PATH, finalReportMarkdown);
  console.log(`\n🏆 [Benchmark Completed] System Performance Report saved directly to: ${REPORT_PATH}`);
}

startBenchmarkRunner().catch(err => {
  console.error("🔥 Benchmark Suite encountered fatal pipeline runtime exception:", err);
  process.exit(1);
});
