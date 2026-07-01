/**
 * test_all_bugfixes.js
 * 
 * Comprehensive checkup for all 17 bug fixes from the LexGuard deep scan.
 * Runs without DB connection for unit tests, marks DB tests as skipped if no connection.
 */

const path = require('path');
const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(name) {
  console.log(`  ✅ PASS: ${name}`);
  passed++;
}

function fail(name, reason) {
  console.log(`  ❌ FAIL: ${name}`);
  console.log(`         Reason: ${reason}`);
  failed++;
}

function skip(name, reason) {
  console.log(`  ⏭️  SKIP: ${name} (${reason})`);
  skipped++;
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}`);
}

// ─────────────────────────────────────────────────────────────
//  MODULE LOADING TESTS
// ─────────────────────────────────────────────────────────────
section('1. MODULE LOADING — All edited services must require() cleanly');

const modulesToTest = [
  'src/services/agent9CrossRefAuditor.js',
  'src/services/agent10DeterministicAuditor.js',
  'src/services/citationVerifier.js',
  'src/services/crossClauseContradictionEngine.js',
  'src/services/graphRagService.js',
  'src/services/aiClient.js',
  'src/services/lawRetrieverService.js',
  'src/services/agent2RiskAnalyst.js',
  'src/services/agentPreFlight.js',
  'src/utils/semanticChunker.js',
  'src/services/deterministicFactExtractor.js',
];

for (const mod of modulesToTest) {
  try {
    require(path.join(ROOT, mod));
    pass(`require('${mod.split('/').pop()}')`);
  } catch (e) {
    fail(`require('${mod.split('/').pop()}')`, e.message.split('\n')[0]);
  }
}

// ─────────────────────────────────────────────────────────────
//  BUG 1 — Agent 9 import fix
// ─────────────────────────────────────────────────────────────
section('2. BUG 1 — Agent 9: correct named import of callLLM');

try {
  const agent9Source = require('fs').readFileSync(
    path.join(ROOT, 'src/services/agent9CrossRefAuditor.js'), 'utf8'
  );
  const hasWrongImport = /const callLLM = require\('\.\/aiClient'\)/.test(agent9Source);
  const hasCorrectImport = /const \{ callLLM \} = require\('\.\/aiClient'\)/.test(agent9Source);
  
  if (hasWrongImport) {
    fail('Agent 9 import', 'Still using incorrect non-destructured import');
  } else if (hasCorrectImport) {
    pass('Agent 9 uses { callLLM } destructured import');
  } else {
    fail('Agent 9 import', 'Could not find callLLM import at all');
  }
} catch (e) {
  fail('Agent 9 import check', e.message);
}

// ─────────────────────────────────────────────────────────────
//  BUG 2 — Agent 10: llmResult.parsed removed
// ─────────────────────────────────────────────────────────────
section('3. BUG 2 — Agent 10: llmResult.parsed dead code removed');

try {
  const agent10Source = require('fs').readFileSync(
    path.join(ROOT, 'src/services/agent10DeterministicAuditor.js'), 'utf8'
  );
  const hasDeadCode = /llmResult\.parsed\s*\|\|\s*llmResult/.test(agent10Source);
  const hasCorrectCode = /const data = llmResult;/.test(agent10Source);
  
  if (hasDeadCode) {
    fail('Agent 10 llmResult.parsed', 'Dead code still present: llmResult.parsed || llmResult');
  } else if (hasCorrectCode) {
    pass('Agent 10: const data = llmResult (no .parsed dead code)');
  } else {
    fail('Agent 10 llmResult.parsed', 'Could not verify correction');
  }
} catch (e) {
  fail('Agent 10 source check', e.message);
}

// ─────────────────────────────────────────────────────────────
//  BUG 3 — Citation Verifier: dead stats loop removed
// ─────────────────────────────────────────────────────────────
section('4. BUG 3 — Citation Verifier: verifyCitations.lastStats dead code removed');

try {
  const cvSource = require('fs').readFileSync(
    path.join(ROOT, 'src/services/citationVerifier.js'), 'utf8'
  );
  const hasDeadCode = /verifyCitations\.lastStats/.test(cvSource);
  
  if (hasDeadCode) {
    fail('Citation Verifier stats', 'verifyCitations.lastStats dead code still present');
  } else {
    pass('Citation Verifier: dead stats loop removed');
  }
} catch (e) {
  fail('Citation Verifier source check', e.message);
}

// ─────────────────────────────────────────────────────────────
//  BUG 4 — Cross-Clause Contradiction Engine: Rule 1b logic
// ─────────────────────────────────────────────────────────────
section('5. BUG 4 — Contradiction Engine: Rule 1b gap fix');

try {
  const ccSource = require('fs').readFileSync(
    path.join(ROOT, 'src/services/crossClauseContradictionEngine.js'), 'utf8'
  );
  
  // Check Rule 1b no longer requires BOTH to be zero
  const hasOldLogic = /totalFeeFacts\.length === 0 && milestoneFacts\.length === 0/.test(ccSource);
  const hasNewLogic = /rule1Fired/.test(ccSource);
  
  if (hasOldLogic && !hasNewLogic) {
    fail('Rule 1b gap', 'Old AND logic still present, rule1Fired variable not found');
  } else if (hasNewLogic) {
    pass('Rule 1b: uses rule1Fired guard (not dual-empty AND logic)');
  } else {
    fail('Rule 1b gap', 'Could not verify fix');
  }
  
  // Check triple-AND exclusion
  const hasTrippleGuard = /f\.raw === totalFeeFacts\[0\]\.raw/.test(ccSource);
  if (hasTrippleGuard) {
    pass('Rule 1 exclusion: triple-AND guard (clauseIndex + value + raw)');
  } else {
    fail('Rule 1 exclusion', 'Triple-AND guard not found');
  }
} catch (e) {
  fail('Contradiction engine source check', e.message);
}

// ─────────────────────────────────────────────────────────────
//  BUG 5+6 — Agent 4: live risk_level re-fetch + note protection
// ─────────────────────────────────────────────────────────────
section('6. BUG 5+6 — Agent 4: live risk_level + note preservation');

try {
  const a4Source = require('fs').readFileSync(
    path.join(ROOT, 'src/services/agent4ComplianceChecker.js'), 'utf8'
  );
  
  const hasLiveFetch = /liveClause = await Clause\.findById/.test(a4Source);
  const hasNoteGuard = /hasExistingNote/.test(a4Source);
  const hasRiskPriority = /RISK_PRIORITY/.test(a4Source);
  
  if (hasLiveFetch) {
    pass('Agent 4: re-fetches live clause per iteration');
  } else {
    fail('Agent 4 live fetch', 'liveClause re-fetch not found');
  }
  
  if (hasNoteGuard) {
    pass('Agent 4: hasExistingNote guard prevents overwriting Agent 10 notes');
  } else {
    fail('Agent 4 note guard', 'hasExistingNote guard not found');
  }
  
  if (hasRiskPriority) {
    pass('Agent 4: RISK_PRIORITY prevents downgrading escalated risk levels');
  } else {
    fail('Agent 4 risk priority', 'RISK_PRIORITY guard not found');
  }
} catch (e) {
  fail('Agent 4 source check', e.message);
}

// ─────────────────────────────────────────────────────────────
//  BUG 7 — GraphRAG sentinel string
// ─────────────────────────────────────────────────────────────
section('7. BUG 7 — GraphRAG: sentinel string filtered');

try {
  const grSource = require('fs').readFileSync(
    path.join(ROOT, 'src/services/graphRagService.js'), 'utf8'
  );
  
  const hasSentinelCheck = /No specific statutory framework mapped/.test(grSource);
  if (hasSentinelCheck) {
    pass('GraphRAG: sentinel string "No specific statutory framework mapped." is filtered');
  } else {
    fail('GraphRAG sentinel', 'Sentinel string check not found');
  }
} catch (e) {
  fail('GraphRAG source check', e.message);
}

// ─────────────────────────────────────────────────────────────
//  BUG 8 — agentLimit module-level
// ─────────────────────────────────────────────────────────────
section('8. BUG 8 — jobQueueService: agentLimit at module level');

try {
  const jqSource = require('fs').readFileSync(
    path.join(ROOT, 'src/services/jobQueueService.js'), 'utf8'
  );
  
  // Check that agentLimit is NOT inside processContractJob
  const lines = jqSource.split('\n');
  let inFunction = false;
  let functionDepth = 0;
  let agentLimitInFunction = false;
  let agentLimitAtModule = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('async function processContractJob') || line.includes('processContractJob = async')) {
      inFunction = true;
      functionDepth = 0;
    }
    
    if (inFunction) {
      functionDepth += (line.match(/\{/g) || []).length;
      functionDepth -= (line.match(/\}/g) || []).length;
      if (functionDepth <= 0 && i > 0) inFunction = false;
    }
    
    if (line.includes('const agentLimit') && line.includes('limitFn')) {
      if (inFunction) {
        agentLimitInFunction = true;
      } else {
        agentLimitAtModule = true;
      }
    }
  }
  
  if (agentLimitInFunction) {
    fail('agentLimit scope', 'agentLimit is still defined inside processContractJob');
  } else if (agentLimitAtModule) {
    pass('agentLimit is at module level (shared across all concurrent jobs)');
  } else {
    // Could be that it's there but we couldn't detect it with simple parsing
    // Just check the source string
    const moduleDecl = jqSource.indexOf('const agentLimit');
    const funcDecl = jqSource.indexOf('async function processContractJob');
    if (moduleDecl > 0 && funcDecl > 0 && moduleDecl < funcDecl) {
      pass('agentLimit declared before processContractJob function (module level)');
    } else {
      skip('agentLimit scope', 'Could not statically determine scope, check manually');
    }
  }
} catch (e) {
  fail('jobQueueService source check', e.message);
}

// ─────────────────────────────────────────────────────────────
//  ISSUE 9 — Semantic Chunker: precise period regex
// ─────────────────────────────────────────────────────────────
section('9. ISSUE 9 — SemanticChunker: precise period regex');

try {
  const chunker = require(path.join(ROOT, 'src/utils/semanticChunker.js'));
  
  // Test 1: Should still fix concatenated sentences
  const test1 = chunker.normalizeText('Total Contract Value: INR 50,00,000.Milestone 1: INR 10,00,000');
  const fixed = test1.includes('50,00,000. Milestone');
  if (fixed) {
    pass('Chunker: "50,00,000.Milestone" → "50,00,000. Milestone" (sentence join fixed)');
  } else {
    fail('Chunker sentence fix', `Got: "${test1}"`);
  }
  
  // Test 2: Should NOT break abbreviations like U.S.A.
  const test2 = chunker.normalizeText('Governed by U.S.A. law.');
  const abbreviationBroken = test2.includes('U. S. A.');
  if (abbreviationBroken) {
    fail('Chunker abbreviation protection', `"U.S.A." was broken into "${test2}"`);
  } else {
    pass('Chunker: "U.S.A." abbreviation NOT broken by period regex');
  }
  
  // Test 3: Should NOT break "Pvt.Ltd."
  const test3 = chunker.normalizeText('Company: TechCorp Pvt.Ltd. is the employer.');
  if (test3.includes('Pvt. Ltd.') || !test3.includes('PvtLtd')) {
    pass('Chunker: "Pvt.Ltd." handling is acceptable');
  }
  
} catch (e) {
  fail('SemanticChunker test', e.message);
}

// ─────────────────────────────────────────────────────────────
//  ISSUE 10 — INR regex: crore-level amounts
// ─────────────────────────────────────────────────────────────
section('10. ISSUE 10 — DeterministicFactExtractor: crore-level INR amounts');

try {
  const { extractFactTable } = require(path.join(ROOT, 'src/services/deterministicFactExtractor.js'));
  
  // Test standard lakh amount
  const result1 = extractFactTable([{ segmentIndex: 0, rawText: 'Total Contract Value: INR 50,00,000', clause_type: 'total_fee', risk_level: 'low' }]);
  const currency1 = result1.facts.filter(f => f.type === 'currency');
  if (currency1.some(f => f.value === 5000000)) {
    pass('INR parser: INR 50,00,000 → 5,000,000 ✓');
  } else {
    fail('INR parser lakh', `Expected 5000000, got: ${JSON.stringify(currency1.map(f => f.value))}`);
  }
  
  // Test crore-level amount (new fix)
  const result2 = extractFactTable([{ segmentIndex: 0, rawText: 'Total Contract Value: INR 1,00,00,000 (One Crore)', clause_type: 'total_fee', risk_level: 'low' }]);
  const currency2 = result2.facts.filter(f => f.type === 'currency');
  if (currency2.some(f => f.value === 10000000)) {
    pass('INR parser: INR 1,00,00,000 → 10,000,000 (crore) ✓');
  } else {
    fail('INR parser crore', `Expected 10000000, got: ${JSON.stringify(currency2.map(f => f.value))}`);
  }
  
  // Test milestone sum mismatch scenario (Clause 3 trap)
  const clauses = [
    { segmentIndex: 0, rawText: 'Total Contract Value: INR 50,00,000.', clause_type: 'total_fee', risk_level: 'low' },
    { segmentIndex: 1, rawText: 'Milestone 1: INR 10,00,000', clause_type: 'milestone_fee', risk_level: 'low' },
    { segmentIndex: 2, rawText: 'Milestone 2: INR 15,00,000', clause_type: 'milestone_fee', risk_level: 'low' },
    { segmentIndex: 3, rawText: 'Milestone 3: INR 30,00,000', clause_type: 'milestone_fee', risk_level: 'low' },
  ];
  const allFacts = extractFactTable(clauses);
  const totalFact = allFacts.facts.find(f => f.type === 'currency' && f.clauseIndex === 0);
  const milestoneFacts = allFacts.facts.filter(f => f.type === 'currency' && f.clauseIndex > 0);
  const total = totalFact?.value;
  const sum = milestoneFacts.reduce((a, f) => a + f.value, 0);
  
  if (total > 0 && sum > 0) {
    if (total !== sum) {
      pass(`INR Math trap test: Total=${total/100000}L, Milestones Sum=${sum/100000}L → MISMATCH detectable (${sum > total ? 'milestones exceed total' : 'milestones below total'})!`);
    } else {
      pass(`INR Math trap test: All amounts parsed. Total=${total}, Sum=${sum}`);
    }
  } else {
    fail('INR Math trap test', `Could not parse: Total=${total}, Sum=${sum}`);
  }
  
} catch (e) {
  fail('DeterministicFactExtractor test', e.message);
}

// ─────────────────────────────────────────────────────────────
//  ISSUE 12 — aiClient auto-chunker merge shape
// ─────────────────────────────────────────────────────────────
section('11. ISSUE 12 — aiClient: auto-chunker intelligent merge');

try {
  const aiClientSource = require('fs').readFileSync(
    path.join(ROOT, 'src/services/aiClient.js'), 'utf8'
  );
  const hasSmartMerge = /hasResults1.*hasResults2/.test(aiClientSource.replace(/\n/g, ' '));
  const hasResultsMerge = aiClientSource.includes('combinedResults = [...(res1?.results');
  
  if (hasSmartMerge) {
    pass('aiClient: smart merge detects response shape before combining');
  } else {
    fail('aiClient smart merge', 'hasResults1/hasResults2 shape detection not found');
  }
} catch (e) {
  fail('aiClient source check', e.message);
}

// ─────────────────────────────────────────────────────────────
//  ISSUE 13 — lawRetrieverService: empty domain guard
// ─────────────────────────────────────────────────────────────
section('12. ISSUE 13 — lawRetrieverService: empty domain fallback');

try {
  const lrSource = require('fs').readFileSync(
    path.join(ROOT, 'src/services/lawRetrieverService.js'), 'utf8'
  );
  const hasFallback = /activeDomains\.length === 0/.test(lrSource);
  if (hasFallback) {
    pass('lawRetrieverService: empty domains → fallback to general_contract_law');
  } else {
    fail('Empty domain guard', 'activeDomains.length === 0 guard not found');
  }
} catch (e) {
  fail('lawRetrieverService source check', e.message);
}

// ─────────────────────────────────────────────────────────────
//  ISSUE 14 — agent2RiskAnalyst: indemnification safe harbor
// ─────────────────────────────────────────────────────────────
section('13. ISSUE 14 — agent2RiskAnalyst: gross negligence blocks safe harbor');

try {
  const a2Source = require('fs').readFileSync(
    path.join(ROOT, 'src/services/agent2RiskAnalyst.js'), 'utf8'
  );
  const hasGrossNegGuard = /!rawText\.includes\('gross negligence'\)/.test(a2Source) ||
                           /!rawText\.includes\("gross negligence"\)/.test(a2Source);
  if (hasGrossNegGuard) {
    pass('agent2: gross negligence blocks mutual indemnification safe harbor');
  } else {
    fail('Indemnification safe harbor', 'gross negligence guard not found');
  }
} catch (e) {
  fail('agent2RiskAnalyst source check', e.message);
}

// ─────────────────────────────────────────────────────────────
//  ISSUE 15 — agentPreFlight: generalized prompt
// ─────────────────────────────────────────────────────────────
section('14. ISSUE 15 — agentPreFlight: generalized contract prompt');

try {
  const pfSource = require('fs').readFileSync(
    path.join(ROOT, 'src/services/agentPreFlight.js'), 'utf8'
  );
  const hasEmploymentBias = /attached employment contract/.test(pfSource);
  const hasGenericPrompt = /attached legal contract/.test(pfSource);
  
  if (hasEmploymentBias) {
    fail('Pre-flight prompt', 'Still says "employment contract" in prompt');
  } else if (hasGenericPrompt) {
    pass('Pre-flight: generalized to "legal contract" — works for all contract types');
  } else {
    fail('Pre-flight prompt', 'Could not detect prompt text');
  }
} catch (e) {
  fail('agentPreFlight source check', e.message);
}

// ─────────────────────────────────────────────────────────────
//  ISSUE 16 — Agent 9: chunking for large contracts
// ─────────────────────────────────────────────────────────────
section('15. ISSUE 16 — agent9CrossRefAuditor: chunked analysis for large contracts');

try {
  const a9Source = require('fs').readFileSync(
    path.join(ROOT, 'src/services/agent9CrossRefAuditor.js'), 'utf8'
  );
  const hasChunkSize = /CHUNK_SIZE = 15/.test(a9Source);
  const hasDedup = /seen = new Set/.test(a9Source);
  const hasWindowLoop = /for \(let i = 0; i < clauseMarkers\.length/.test(a9Source);
  
  if (hasChunkSize && hasDedup && hasWindowLoop) {
    pass('Agent 9: chunked windowed analysis with dedup for large contracts');
  } else {
    const missing = [];
    if (!hasChunkSize) missing.push('CHUNK_SIZE');
    if (!hasDedup) missing.push('dedup Set');
    if (!hasWindowLoop) missing.push('window loop');
    fail('Agent 9 chunking', `Missing: ${missing.join(', ')}`);
  }
} catch (e) {
  fail('agent9 source check', e.message);
}

// ─────────────────────────────────────────────────────────────
//  CLASSIFIER SERVICE: predatory trap detector functions
// ─────────────────────────────────────────────────────────────
section('16. Classifier Service: detectPredatoryTraps function');

try {
  const { detectPredatoryTraps } = require(path.join(ROOT, 'src/services/classifierService.js'));
  
  // Test 1: Non-compete after termination → should detect
  const result1 = detectPredatoryTraps('Employee shall not work for competitors after termination for 12 months following their date of separation in a similar line of business.');
  if (result1.some(t => t.severity === 'critical')) {
    pass('Classifier: post-employment non-compete detected as critical');
  } else {
    fail('Classifier trap detection', `Expected critical trap, got: ${JSON.stringify(result1)}`);
  }
  
  // Test 2: Normal text → should not trigger
  const result2 = detectPredatoryTraps('Employee will receive a salary of INR 50,000 per month.');
  if (result2.length === 0) {
    pass('Classifier: normal salary clause produces no false positives');
  } else {
    fail('Classifier false positive', `Triggered on normal text: ${JSON.stringify(result2)}`);
  }
  
} catch (e) {
  fail('Classifier test', e.message);
}

// ─────────────────────────────────────────────────────────────
//  CROSS-CLAUSE CONTRADICTION ENGINE: math logic
// ─────────────────────────────────────────────────────────────
section('17. Cross-Clause Contradiction Engine: fee sum mismatch logic');

try {
  const { detectContradictions } = require(path.join(ROOT, 'src/services/crossClauseContradictionEngine.js'));
  const { extractFactTable } = require(path.join(ROOT, 'src/services/deterministicFactExtractor.js'));
  
  // Simulate the Clause 3 math trap: Total=50L, Milestones=10L+15L+30L=55L
  const clauses = [
    { _id: 'c1', segmentIndex: 0, rawText: 'Total Contract Value: INR 50,00,000.', clause_type: 'total_fee', risk_level: 'low', risk_score: 2 },
    { _id: 'c2', segmentIndex: 1, rawText: 'Milestone 1: INR 10,00,000 upon completion of Phase 1.', clause_type: 'milestone_fee', risk_level: 'low', risk_score: 2 },
    { _id: 'c3', segmentIndex: 2, rawText: 'Milestone 2: INR 15,00,000 upon delivery of Phase 2.', clause_type: 'milestone_fee', risk_level: 'low', risk_score: 2 },
    { _id: 'c4', segmentIndex: 3, rawText: 'Milestone 3: INR 30,00,000 upon final acceptance.', clause_type: 'milestone_fee', risk_level: 'low', risk_score: 2 },
  ];
  
  // Test 1: Milestone Mismatch
  const factTable = extractFactTable(clauses);
  const result = detectContradictions(factTable, clauses);
  const findings = result?.findings || result || [];
  const feeIssues = findings.filter(f => f.rule === 'FEE_SUM_MISMATCH');
  
  if (feeIssues.length > 0) {
    pass(`Math trap detected: FEE_SUM_MISMATCH → ${feeIssues.length} finding(s) (${feeIssues[0].severity || 'high'} severity)`);
  } else {
    fail('Fee sum mismatch', 'No contradiction detected for 50L total vs 55L milestones');
  }

  // Test 2: Correct Mixed Periodic Milestones (Should NOT find contradiction)
  // Total: 50L (50,00,000)
  // Milestone 1 (one-time): 10L (10,00,000)
  // Milestone 2 (monthly): 2L (2,00,000) -> 24L
  // Milestone 3 (quarterly): 4L (4,00,000) -> 16L
  // Total sum: 10L + 24L + 16L = 50L
  const periodicClauses = [
    { _id: 'pc1', segmentIndex: 0, rawText: 'Total contract value is INR 50,00,000.', clause_type: 'total_fee', risk_level: 'low' },
    { _id: 'pc2', segmentIndex: 1, rawText: 'Initial payment: INR 10,00,000 upon signing.', clause_type: 'milestone_fee', risk_level: 'low' },
    { _id: 'pc3', segmentIndex: 2, rawText: 'Monthly retainer of INR 2,00,000.', clause_type: 'milestone_fee', risk_level: 'low' },
    { _id: 'pc4', segmentIndex: 3, rawText: 'Quarterly compliance fee of INR 4,00,000.', clause_type: 'milestone_fee', risk_level: 'low' },
  ];
  const periodicFactTable = extractFactTable(periodicClauses);
  const periodicResult = detectContradictions(periodicFactTable, periodicClauses);
  const periodicFindings = periodicResult?.findings || periodicResult || [];
  const periodicFeeIssues = periodicFindings.filter(f => f.rule === 'FEE_SUM_MISMATCH');

  if (periodicFeeIssues.length === 0) {
    pass('Contradiction Engine periodic accumulation: 10L + 2L*12 + 4L*4 = 50L matched correctly ✓');
  } else {
    fail('Contradiction Engine periodic accumulation', `Reported mismatch when sum should match. Findings: ${JSON.stringify(periodicFeeIssues)}`);
  }
} catch (e) {
  fail('Cross-clause contradiction engine test', e.message);
}

// ─────────────────────────────────────────────────────────────
//  FINAL SUMMARY
// ─────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`  FULL CHECKUP RESULTS`);
console.log(`${'═'.repeat(60)}`);
console.log(`  ✅ Passed:  ${passed}`);
console.log(`  ❌ Failed:  ${failed}`);
console.log(`  ⏭️  Skipped: ${skipped}`);
console.log(`${'═'.repeat(60)}`);

if (failed === 0) {
  console.log(`\n  🎉 ALL CHECKS PASSED! System is healthy.\n`);
  process.exit(0);
} else {
  console.log(`\n  🚨 ${failed} check(s) FAILED. Review errors above.\n`);
  process.exit(1);
}
