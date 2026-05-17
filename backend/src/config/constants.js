const CONTRACT_CATEGORIES = ['employment', 'saas', 'freelance', 'tos', 'privacy', 'other'];

const CONTRACT_STATUSES = ['pending', 'processing', 'done', 'failed'];

const CLAUSE_TYPES = [
  'non_compete',
  'ip_ownership',
  'privacy_data',
  'termination',
  'liability_limit',
  'indemnity',
  'arbitration',
  'auto_renewal',
  'payment',
  'confidentiality',
  'governing_law',
  'amendment',
  'warranty',
  'force_majeure',
  'other',
];

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

const COMPLIANCE_RISK_LEVELS = ['low', 'medium', 'high'];

const AI_MODEL_NAME = process.env.AI_MODEL_NAME || 'lexguard-default';

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

module.exports = {
  CONTRACT_CATEGORIES,
  CONTRACT_STATUSES,
  CLAUSE_TYPES,
  RISK_LEVELS,
  COMPLIANCE_RISK_LEVELS,
  AI_MODEL_NAME,
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
};
