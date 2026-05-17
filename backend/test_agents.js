/**
 * Quick sanity check for Gemini AI client + Agent 1 + Agent 2.
 * Run: node test_agents.js
 */
require('dotenv').config();

const { callLLM } = require('./src/services/aiClient');
const { runAgent1ClauseExtractor } = require('./src/services/agent1ClauseExtractor');
const { runAgent2RiskAnalyst } = require('./src/services/agent2RiskAnalyst');

const testClauses = [
  {
    id: 'c1',
    text: 'The Employee shall not, for a period of two years after termination, engage in any competing business within India.',
  },
  {
    id: 'c2',
    text: 'All inventions, code, and designs created during employment shall be the exclusive property of the Company.',
  },
  {
    id: 'c3',
    text: 'The Employee shall maintain the confidentiality of all proprietary information and shall not disclose such information to any third party.',
  },
];

(async () => {
  console.log('═══ Test 1: callLLM basic ═══');
  const ping = await callLLM({
    systemPrompt: 'You classify things. Output JSON: {"status":"ok"}',
    userContent: 'classify: hello',
    jsonMode: true,
    temperature: 0.1,
    maxTokens: 256,
  });
  console.log('  Response:', JSON.stringify(ping));
  console.log('  ✅ callLLM works\n');

  console.log('═══ Test 2: Agent 1 (Clause Extractor) ═══');
  const a1 = await runAgent1ClauseExtractor(testClauses);
  console.log('  Results:', JSON.stringify(a1, null, 2));
  console.log(`  ✅ Agent 1 returned ${a1.length} classifications\n`);

  console.log('═══ Test 3: Agent 2 (Risk Analyst) ═══');
  const a2Input = a1.map((r) => ({
    id: r.id,
    text: testClauses.find((c) => c.id === r.id).text,
    clause_type: r.clause_type,
  }));
  const a2 = await runAgent2RiskAnalyst(a2Input);
  console.log('  Results:', JSON.stringify(a2, null, 2));
  console.log(`  ✅ Agent 2 returned ${a2.length} risk analyses\n`);

  // Validate shapes
  let ok = true;
  for (const r of a1) {
    if (!r.id || !r.clause_type) { ok = false; console.error('  ❌ Agent 1 missing fields'); }
  }
  for (const r of a2) {
    if (!r.id || !r.risk_level || r.risk_score === undefined) { ok = false; console.error('  ❌ Agent 2 missing fields'); }
  }
  if (ok) console.log('🟢 All agent tests passed!');
  else { console.error('🔴 Some agent tests failed.'); process.exit(1); }
})().catch((e) => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
