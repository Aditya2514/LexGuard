const fs = require('fs');
const JSZip = require('jszip');

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

const CONTRACT_PARAS = [
  'EMPLOYMENT AGREEMENT',
  'This Agreement is made effective as of January 1 2025 between TechCorp India Pvt Ltd (Company) and Rahul Sharma (Employee).',
  '1. NON-COMPETE CLAUSE',
  'The Employee shall not compete for a period of three years after termination of employment in any territory worldwide.',
  '2. INTELLECTUAL PROPERTY',
  'All inventions and work products created during employment shall be owned exclusively by the Company with no exceptions.'
];

(async () => {
  const buf = await makeDocx(CONTRACT_PARAS);
  fs.writeFileSync('test_contract.docx', buf);
  console.log('Saved test_contract.docx');
})();
