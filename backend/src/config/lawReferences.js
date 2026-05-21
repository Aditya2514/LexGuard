/**
 * Static config for Indian law references used by Agent 2 & Agent 4.
 * These are NOT stored in the DB. Agents output act_key values
 * which the backend maps to this config at response time.
 *
 * Phase 1: defined here only — not used yet.
 * Phase 2+: Agent 2 and Agent 4 will reference these keys.
 */
const LAW_REFERENCES = {
  INDIAN_CONTRACT_ACT: {
    act_key: 'INDIAN_CONTRACT_ACT',
    act_name: 'Indian Contract Act, 1872',
    description:
      'General principles of contracts, including fairness, restraint of trade, and unconscionable terms.',
    reference_url:
      'https://www.indiacode.nic.in/bitstream/123456789/2187/1/A187209.pdf',
  },
  DPDP_ACT: {
    act_key: 'DPDP_ACT',
    act_name: 'Digital Personal Data Protection Act, 2023',
    description:
      'Regulates processing of personal data, consent mechanisms, and data principal rights in India.',
    reference_url:
      'https://www.meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf',
  },
  ARBITRATION_ACT: {
    act_key: 'ARBITRATION_ACT',
    act_name: 'Arbitration and Conciliation Act, 1996',
    description:
      'Framework for arbitration agreements, seat of arbitration, and dispute resolution procedures in India.',
    reference_url:
      'https://www.advocatekhoj.com/library/bareacts/arbitrationandconciliation/index.php',
  },
  IT_ACT: {
    act_key: 'IT_ACT',
    act_name: 'Information Technology Act, 2000',
    description:
      'Governs cybercrime, data protection obligations, electronic signatures, and intermediary liability in India.',
    reference_url:
      'https://www.indiacode.nic.in/bitstream/123456789/1999/1/200021.pdf',
  },
  PATENTS_ACT: {
    act_key: 'PATENTS_ACT',
    act_name: 'Patents Act, 1970',
    description:
      'Governs employee inventions, patent filing, and licensing requirements in India.',
    reference_url:
      'https://www.indiacode.nic.in/bitstream/123456789/1392/1/197039.pdf',
  },
  INDUSTRIAL_DISPUTES_ACT: {
    act_key: 'INDUSTRIAL_DISPUTES_ACT',
    act_name: 'Industrial Disputes Act, 1947',
    description:
      'Governs dispute resolutions, lay-offs, retrenchment wage settlements, and severance terms for Indian workers.',
    reference_url:
      'https://www.indiacode.nic.in/bitstream/123456789/15336/1/industrial_disputes_act_1947.pdf',
  },
  CONSUMER_PROTECTION_ACT: {
    act_key: 'CONSUMER_PROTECTION_ACT',
    act_name: 'Consumer Protection Act, 2019',
    description:
      'Provides framework to protect consumers against unfair contract terms and unconscionable conditions.',
    reference_url:
      'https://www.indiacode.nic.in/bitstream/123456789/15256/1/consumer_protection_act_2019.pdf',
  },
  PAYMENT_OF_WAGES_ACT: {
    act_key: 'PAYMENT_OF_WAGES_ACT',
    act_name: 'Payment of Wages Act, 1936',
    description:
      'Governs timely wage payouts and regulates permissible wage deductions for employee cohorts.',
    reference_url:
      'https://www.indiacode.nic.in/bitstream/123456789/2154/1/A193604.pdf',
  },
  COPYRIGHT_ACT: {
    act_key: 'COPYRIGHT_ACT',
    act_name: 'Copyright Act, 1957',
    description:
      'Governs author rights, assignments, and statutory reversion of intellectual property under Indian law.',
    reference_url:
      'https://www.indiacode.nic.in/bitstream/123456789/1367/1/195714.pdf',
  },
  CASE_LAW: {
    act_key: 'CASE_LAW',
    act_name: 'Judicial Precedent (Supreme Court / High Court)',
    description:
      'Legally binding decisions set by superior courts that govern the interpretation and application of statutory law.',
    reference_url:
      'https://main.sci.gov.in/judgments/',
  },
  OTHER: {
    act_key: 'OTHER',
    act_name: 'General Indian Contract & Civic Laws',
    description:
      'Other relevant civic provisions governing legal contracts and agreements.',
    reference_url:
      'https://www.indiacode.nic.in/',
  },
};

module.exports = { LAW_REFERENCES };
