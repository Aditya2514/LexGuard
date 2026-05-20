const mongoose = require('mongoose');
const { CONTRACT_CATEGORIES, CONTRACT_STATUSES, RISK_LEVELS } = require('../config/constants');

const agentMetadataSchema = new mongoose.Schema(
  {
    preFlightExtractedAt: { type: Date, default: null },
    isPreFlightComplete: { type: Boolean, default: false },
    extractedAt: { type: Date, default: null },
    analysedAt: { type: Date, default: null },
    advocatedAt: { type: Date, default: null },
    complianceCheckedAt: { type: Date, default: null },
  },
  { _id: false }
);

const contractSchema = new mongoose.Schema(
  {
    originalFileName: {
      type: String,
      required: [true, 'Original file name is required'],
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: CONTRACT_STATUSES,
      default: 'processing',
    },
    contractCategory: {
      type: String,
      enum: CONTRACT_CATEGORIES,
      required: [true, 'Contract category is required'],
    },
    rawText: {
      type: String,
      default: '',
    },
    totalClauses: {
      type: Number,
      default: 0,
    },
    // V3 Architecture: Dynamic Global Context Payload
    globalContext: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Populated in Phase 2+ by Agent 2.
    // NOTE: null is a valid default — Mongoose enum doesn't support null natively,
    // so we use a custom validator that passes null through and validates strings.
    overallRiskLevel: {
      type: String,
      default: null,
      validate: {
        validator: (v) => v === null || RISK_LEVELS.includes(v),
        message: (props) => `${props.value} is not a valid risk level.`,
      },
    },
    // Timestamps set by each agent in Phase 2–4
    agentMetadata: {
      type: agentMetadataSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contract', contractSchema);
