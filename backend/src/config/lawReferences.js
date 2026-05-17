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
      'https://www.indiacode.nic.in/handle/123456789/22037?view_type=browse',
  },
  ARBITRATION_ACT: {
    act_key: 'ARBITRATION_ACT',
    act_name: 'Arbitration and Conciliation Act, 1996',
    description:
      'Framework for arbitration agreements, seat of arbitration, and dispute resolution procedures in India.',
    reference_url:
      'https://www.advocatekhoj.com/library/bareacts/arbitrationandconciliation/index.php',
  },
};

module.exports = { LAW_REFERENCES };
