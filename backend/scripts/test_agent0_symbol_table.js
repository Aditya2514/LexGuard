require('dotenv').config();
const { buildGlobalSymbolTable } = require('../src/services/agent0SymbolTable');

const MEGA_CONTRACT_MOCK = `
THIS MASTER EMPLOYMENT AND CONFIDENTIALITY AGREEMENT (the "Agreement") is made on this 1st day of June, 2026, by and between:
TechCorp India Pvt Ltd, a company incorporated under the Companies Act, 2013 (hereinafter referred to as the "Company"),
AND
John Doe, residing at 123 Main St, Bangalore (hereinafter referred to as the "Employee").

1. DEFINITIONS
For the purposes of this Agreement, the following terms shall have the meanings ascribed to them below:
"Confidential Information" means any and all technical and non-technical information provided by the Company to the Employee, including but not limited to source code, trade secrets, business plans, and financial models.
"Restricted Period" means a period of 24 months following the Date of Separation.
"Date of Separation" means the effective date of termination of the Employee's employment, for any reason whatsoever.
"Competitive Business" means any business engaged in developing AI legal technology in India or Southeast Asia.

[... 10,000 words of standard boilerplate ...]

2. NON-COMPETE
During the Restricted Period, the Employee shall not engage in any Competitive Business.
`;

async function runTest() {
  console.log('🧪 Testing Agent 0 - Symbol Table Extraction');
  try {
    const table = await buildGlobalSymbolTable(MEGA_CONTRACT_MOCK);
    console.log('\\n✅ Extracted Symbol Table:');
    console.log(JSON.stringify(table, null, 2));

    const expectedKeys = ['Company', 'Employee', 'Confidential Information', 'Restricted Period', 'Date of Separation', 'Competitive Business'];
    let passed = true;
    for (const key of expectedKeys) {
        // Just checking if a case-insensitive key exists
        const found = Object.keys(table).some(k => k.toLowerCase() === key.toLowerCase());
        if (!found) {
            console.error(`❌ Missing expected definition: ${key}`);
            passed = false;
        }
    }

    if (passed) {
        console.log('\\n🎉 All expected definitions were successfully extracted!');
    } else {
        console.log('\\n⚠️ Some definitions were missed.');
    }
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

runTest();
