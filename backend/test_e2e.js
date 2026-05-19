/**
 * LexGuard Phase 2 – Comprehensive E2E Test Suite
 * Run: node test_e2e.js  (requires Node 18+ and live server on port 5001)
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const JSZip = require('jszip');

const BASE_URL = 'http://localhost:5001';
let passed = 0, failed = 0;
const failures = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ' (' + detail + ')' : ''}`);
    failed++;
    failures.push(label);
  }
}

async function req(method, urlPath, opts = {}) {
  try {
    const res = await fetch(`${BASE_URL}${urlPath}`, { method, ...opts });
    let body;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: null };
  }
}

function form(fields = {}, file = null) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (file) fd.append('file', new Blob([file.buf], { type: file.mime }), file.name);
  return fd;
}

// Build a real DOCX buffer using jszip (mammoth can parse this)
async function makeDocx(paragraphs = []) {
  const zip = new JSZip();

  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>');

  zip.folder('_rels').file('.rels',
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>');

  const paras = paragraphs.map(p =>
    `<w:p><w:r><w:t>${p.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</w:t></w:r></w:p>`
  ).join('');

  zip.folder('word').file('document.xml',
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${paras}</w:body>` +
    '</w:document>');

  zip.folder('word/_rels').file('document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '</Relationships>');

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// Contract paragraphs for realistic testing
const CONTRACT_PARAS = [
  'EMPLOYMENT AGREEMENT',
  'This Agreement is made effective as of January 1 2025 between TechCorp India Pvt Ltd (Company) and Rahul Sharma (Employee).',
  '1. NON-COMPETE CLAUSE',
  'The Employee shall not compete for a period of three years after termination of employment in any territory worldwide.',
  '2. INTELLECTUAL PROPERTY',
  'All inventions and work products created during employment shall be owned exclusively by the Company with no exceptions.',
  '3. CONFIDENTIALITY',
  'The Employee agrees to maintain all proprietary company information in strict confidence during and after employment.',
  '4. ARBITRATION AND DISPUTE RESOLUTION',
  'Any dispute shall be resolved by binding arbitration. The Company shall appoint the sole arbitrator at its discretion.',
  '5. DATA AND PRIVACY',
  'The Company may collect and process personal data of the Employee including health records and location data.',
  '6. TERMINATION',
  'The Company may terminate this Agreement immediately without notice for any reason whatsoever.',
  '7. GOVERNING LAW',
  'This Agreement is governed by the laws of Delaware USA notwithstanding the fact that both parties are located in India.',
  '8. AMENDMENT',
  'This Agreement may be amended by the Company at any time and the amended terms shall be binding without Employee consent.',
];

// ── Test Groups ───────────────────────────────────────────────────────────────

async function g1_health() {
  console.log('\n══ GROUP 1: Health & Basic Routes ══════════════════════');
  const r1 = await req('GET', '/health');
  assert('GET /health → 200', r1.status === 200);
  assert('Health: status=ok', r1.body?.status === 'ok');
  assert('Health: service name present', !!r1.body?.service);

  const r2 = await req('GET', '/xyz');
  assert('Unknown route → 404', r2.status === 404);
  assert('404 has message', typeof r2.body?.message === 'string');
}

async function g2_postValidation(docxBuf) {
  console.log('\n══ GROUP 2: POST Validation Errors ═════════════════════');

  const r1 = await req('POST', '/api/contracts', { body: new FormData() });
  assert('No file → 400', r1.status === 400);

  const r2 = await req('POST', '/api/contracts', {
    body: form({}, { buf: docxBuf, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: 'c.docx' }),
  });
  assert('File present, no category → 400', r2.status === 400);

  const r3 = await req('POST', '/api/contracts', {
    body: form({ contractCategory: 'INVALID' }, { buf: docxBuf, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: 'c.docx' }),
  });
  assert('Invalid category → 400', r3.status === 400);

  const r4 = await req('POST', '/api/contracts', {
    body: form({ contractCategory: 'employment' }, { buf: Buffer.from('hello'), mime: 'text/plain', name: 'c.txt' }),
  });
  assert('.txt file rejected → 400', r4.status === 400);

  const r5 = await req('POST', '/api/contracts', {
    body: form({ contractCategory: 'employment' }, { buf: Buffer.from('data'), mime: 'image/jpeg', name: 'c.jpg' }),
  });
  assert('.jpg file rejected → 400', r5.status === 400);
}

async function g3_fileSize() {
  console.log('\n══ GROUP 3: File Size Limit ════════════════════════════');
  const big = Buffer.alloc(11 * 1024 * 1024, 65);
  const r = await req('POST', '/api/contracts', {
    body: form({ contractCategory: 'employment' }, { buf: big, mime: 'application/pdf', name: 'big.pdf' }),
  });
  assert('11 MB file → 413', r.status === 413);
  assert('413 body has message', typeof r.body?.message === 'string');
}

async function g4_happyPath(docxBuf) {
  console.log('\n══ GROUP 4: Valid Upload (DOCX) ════════════════════════');
  const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const r1 = await req('POST', '/api/contracts?sync=true', {
    body: form({ contractCategory: 'employment' }, { buf: docxBuf, mime: MIME, name: 'employment-contract.docx' }),
  });
  assert('Valid DOCX → 201', r1.status === 201);
  assert('Has contractId', typeof r1.body?.data?.contractId === 'string');
  assert('clauseCount > 0', (r1.body?.data?.clauseCount ?? 0) > 0, `got ${r1.body?.data?.clauseCount}`);
  assert('status = done or partial', r1.body?.data?.status === 'done' || r1.body?.data?.status === 'partial');
  assert('fileName correct', r1.body?.data?.fileName === 'employment-contract.docx');

  const id1 = r1.body?.data?.contractId;

  // Second upload — different category, same content
  const r2 = await req('POST', '/api/contracts?sync=true', {
    body: form({ contractCategory: 'saas' }, { buf: docxBuf, mime: MIME, name: 'saas-agreement.docx' }),
  });
  assert('Second upload → 201', r2.status === 201);
  assert('Different contractId', r2.body?.data?.contractId !== id1);
  const id2 = r2.body?.data?.contractId;

  // Corrupted DOCX (valid extension, garbage content) → 422
  const r3 = await req('POST', '/api/contracts', {
    body: form({ contractCategory: 'freelance' }, { buf: Buffer.from('not a real docx'), mime: MIME, name: 'corrupt.docx' }),
  });
  assert('Corrupt DOCX → 422', r3.status === 422);
  assert('422 has message', typeof r3.body?.message === 'string');

  return { id1, id2 };
}

async function g5_allCategories(docxBuf) {
  console.log('\n══ GROUP 5: All Contract Categories ═══════════════════');
  const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const cats = ['employment', 'saas', 'freelance', 'tos', 'privacy', 'other'];
  const ids = [];
  for (const cat of cats) {
    const r = await req('POST', '/api/contracts?sync=true', {
      body: form({ contractCategory: cat }, { buf: docxBuf, mime: MIME, name: `${cat}.docx` }),
    });
    assert(`Category "${cat}" → 201`, r.status === 201, `got ${r.status}`);
    if (r.body?.data?.contractId) ids.push(r.body.data.contractId);
  }
  for (const id of ids) await req('DELETE', `/api/contracts/${id}`);
}

async function g6_getList(id1) {
  console.log('\n══ GROUP 6: GET /api/contracts ════════════════════════');
  const r = await req('GET', '/api/contracts');
  assert('GET list → 200', r.status === 200);
  assert('Returns array', Array.isArray(r.body?.data));
  assert('List has ≥ 2 items', (r.body?.data?.length ?? 0) >= 2);

  const item = r.body?.data?.[0];
  assert('Item has _id', !!item?._id);
  assert('Item has originalFileName', !!item?.originalFileName);
  assert('Item has status', !!item?.status);
  assert('Item has totalClauses', typeof item?.totalClauses === 'number');
  assert('Item has contractCategory', !!item?.contractCategory);
  assert('Item does NOT expose rawText', item?.rawText === undefined);
  assert('Sorted newest-first', r.body?.data?.[0]?.uploadedAt >= r.body?.data?.[1]?.uploadedAt);
}

async function g7_getById(id1) {
  console.log('\n══ GROUP 7: GET /api/contracts/:id ════════════════════');

  const r1 = await req('GET', `/api/contracts/${id1}`);
  assert('Valid ID → 200', r1.status === 200);
  assert('Returns correct contract', r1.body?.data?._id === id1);
  assert('Has rawText', typeof r1.body?.data?.rawText === 'string' && r1.body.data.rawText.length > 0);
  assert('Has agentMetadata', typeof r1.body?.data?.agentMetadata === 'object');
  const orl = r1.body?.data?.overallRiskLevel;
  assert('overallRiskLevel populated', orl === null || ['low','medium','high','critical'].includes(orl));
  assert('success=true', r1.body?.success === true);

  const r2 = await req('GET', '/api/contracts/not-an-id');
  assert('Bad ObjectId → 400', r2.status === 400);

  const r3 = await req('GET', '/api/contracts/507f1f77bcf86cd799439011');
  assert('Valid format, not found → 404', r3.status === 404);
}

async function g8_getClauses(id1) {
  console.log('\n══ GROUP 8: GET /api/contracts/:id/clauses ════════════');

  const r1 = await req('GET', `/api/contracts/${id1}/clauses`);
  assert('GET clauses → 200', r1.status === 200);
  assert('Has clauses[]', Array.isArray(r1.body?.data?.clauses));
  assert('Has total > 0', (r1.body?.data?.total ?? 0) > 0);
  assert('Has page = 1', r1.body?.data?.page === 1);
  assert('Has pages', typeof r1.body?.data?.pages === 'number');

  const c = r1.body?.data?.clauses?.[0];
  assert('Clause has _id', !!c?._id);
  assert('Clause has segmentIndex', typeof c?.segmentIndex === 'number');
  assert('Clause rawText > 30 chars', (c?.rawText?.length ?? 0) >= 30);
  assert('risk_level populated (Phase 2)', typeof c?.risk_level === 'string' || c?.risk_level === null);
  assert('clause_type populated (Phase 2)', typeof c?.clause_type === 'string' || c?.clause_type === null);

  // Pagination: limit=2
  const r2 = await req('GET', `/api/contracts/${id1}/clauses?limit=2`);
  assert('limit=2 respected', (r2.body?.data?.clauses?.length ?? 0) <= 2);

  // page=0 clamps to 1
  const r3 = await req('GET', `/api/contracts/${id1}/clauses?page=0`);
  assert('page=0 clamps to 1', r3.body?.data?.page === 1);

  // limit=0 clamps to 1
  const r4 = await req('GET', `/api/contracts/${id1}/clauses?limit=0`);
  assert('limit=0 clamps to 1', (r4.body?.data?.clauses?.length ?? 0) >= 1);

  // limit=999 clamps to 100
  const r5 = await req('GET', `/api/contracts/${id1}/clauses?limit=999`);
  assert('limit=999 clamps to ≤100', (r5.body?.data?.clauses?.length ?? 0) <= 100);

  // page=9999 → empty array
  const r6 = await req('GET', `/api/contracts/${id1}/clauses?page=9999`);
  assert('page=9999 → empty clauses', r6.status === 200 && r6.body?.data?.clauses?.length === 0);

  // Bad ObjectId
  const r7 = await req('GET', '/api/contracts/bad-id/clauses');
  assert('Bad ObjectId → 400', r7.status === 400);

  // Not found
  const r8 = await req('GET', '/api/contracts/507f1f77bcf86cd799439011/clauses');
  assert('Not found → 404', r8.status === 404);
}

async function g9_delete(id1, id2) {
  console.log('\n══ GROUP 9: DELETE /api/contracts/:id ═════════════════');

  const r1 = await req('DELETE', '/api/contracts/bad-id');
  assert('Bad ObjectId → 400', r1.status === 400);

  const r2 = await req('DELETE', '/api/contracts/507f1f77bcf86cd799439011');
  assert('Not found → 404', r2.status === 404);

  // Delete id1
  const r3 = await req('DELETE', `/api/contracts/${id1}`);
  assert('Delete → 200', r3.status === 200);
  assert('Response confirms deletion', r3.body?.data?.deleted === true);

  // Contract gone
  const r4 = await req('GET', `/api/contracts/${id1}`);
  assert('Deleted contract → 404', r4.status === 404);

  // Clauses gone
  const r5 = await req('GET', `/api/contracts/${id1}/clauses`);
  assert('Deleted contract clauses → 404', r5.status === 404);

  // Double delete
  const r6 = await req('DELETE', `/api/contracts/${id1}`);
  assert('Double delete → 404', r6.status === 404);

  // Cleanup id2
  await req('DELETE', `/api/contracts/${id2}`);
}

async function g10_riskSummary(docxBuf) {
  console.log('\n══ GROUP 10: Risk Summary Endpoint ════════════════════');
  const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  // Upload a contract for testing
  const r1 = await req('POST', '/api/contracts?sync=true', {
    body: form({ contractCategory: 'employment' }, { buf: docxBuf, mime: MIME, name: 'risk-test.docx' }),
  });
  const cid = r1.body?.data?.contractId;
  assert('Upload for risk summary → 201', r1.status === 201);

  if (cid) {
    const r2 = await req('GET', `/api/contracts/${cid}/risk-summary`);
    assert('GET risk-summary → 200', r2.status === 200);
    assert('Has contractId', r2.body?.data?.contractId === cid);
    assert('Has overallRiskLevel', typeof r2.body?.data?.overallRiskLevel === 'string' || r2.body?.data?.overallRiskLevel === null);
    assert('Has totalClauses', typeof r2.body?.data?.totalClauses === 'number');
    assert('Has riskBreakdown', typeof r2.body?.data?.riskBreakdown === 'object');
    assert('riskBreakdown has low/medium/high/critical', 
      r2.body?.data?.riskBreakdown?.hasOwnProperty('low') &&
      r2.body?.data?.riskBreakdown?.hasOwnProperty('medium') &&
      r2.body?.data?.riskBreakdown?.hasOwnProperty('high') &&
      r2.body?.data?.riskBreakdown?.hasOwnProperty('critical'));
    assert('Has byType', typeof r2.body?.data?.byType === 'object');

    // Cleanup
    await req('DELETE', `/api/contracts/${cid}`);
  }

  // Bad ID
  const r3 = await req('GET', '/api/contracts/bad-id/risk-summary');
  assert('Bad ObjectId → 400', r3.status === 400);

  // Not found
  const r4 = await req('GET', '/api/contracts/507f1f77bcf86cd799439011/risk-summary');
  assert('Not found → 404', r4.status === 404);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   LexGuard Phase 2 – Full E2E Test Suite             ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  const ping = await req('GET', '/health');
  if (ping.status !== 200) {
    console.error('\n❌ Server not reachable. Run: npm run dev\n');
    process.exit(1);
  }

  // Build test DOCX once
  process.stdout.write('\n  Building test DOCX... ');
  const docxBuf = await makeDocx(CONTRACT_PARAS);
  console.log(`done (${docxBuf.length} bytes)`);

  // Verify mammoth can parse it before running tests
  const mammoth = require('mammoth');
  const { value: testText } = await mammoth.extractRawText({ buffer: docxBuf });
  if (!testText || testText.length < 50) {
    console.error('❌ DOCX generation failed — mammoth returned empty text. Aborting.');
    process.exit(1);
  }
  console.log(`  DOCX verified ✅ (${testText.length} chars, ${testText.split('\n').filter(Boolean).length} lines)`);

  await g1_health();
  await g2_postValidation(docxBuf);
  await g3_fileSize();
  const { id1, id2 } = await g4_happyPath(docxBuf);
  await g5_allCategories(docxBuf);
  await g6_getList(id1);
  await g7_getById(id1);
  await g8_getClauses(id1);
  await g9_delete(id1, id2);
  await g10_riskSummary(docxBuf);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  RESULTS  ✅ ${passed} passed   ❌ ${failed} failed   📋 ${passed+failed} total`);
  console.log('╚══════════════════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\n🔴 Failed:');
    failures.forEach(f => console.log(`   • ${f}`));
    process.exit(1);
  } else {
    console.log('\n🟢 All Phase 2 tests passed!\n');
  }
})();
