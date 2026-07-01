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

const crossRefFindingSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['undefined_term', 'broken_reference', 'circular_definition', 'conflict'] },
    severity: { type: String, enum: ['low', 'medium', 'high'] },
    issue_text: { type: String },
    location_hint: { type: String },
    recommendation: { type: String }
  },
  { _id: false }
);

const contractSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    parentContractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      default: null,
      index: true,
    },
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
    executionDate: {
      type: Date,
      default: null,
      description: 'The date the contract was executed or goes into effect'
    },
    financial_obligations: [{
      amount: { type: Number },
      currency: { type: String, default: 'INR' },
      description: { type: String },
      clause_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Clause' }
    }],
    total_financial_exposure: { type: Number, default: 0 },
    rawText: {
      type: String,
      default: '',
    },
    lifecycle_events: [{
      event_type: String, // e.g., "RENEWAL", "EXPIRATION", "NOTICE_PERIOD"
      date: Date,
      description: String,
      notified: { type: Boolean, default: false }
    }],
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

    // ── Phase 3: Agent 9 (Cross-Reference Auditor) ──────────────────────
    crossRefFindings: { type: [crossRefFindingSchema], default: [] },
    crossRefAuditSummary: { type: String, default: null },

    // ── Citation Statistics (Categorical Breakdown) ───────────────────
    citationStats: {
      totalCitations: { type: Number, default: 0 },
      verified: { type: Number, default: 0 },
      notFound: { type: Number, default: 0 },
      avgAccuracy: { type: Number, default: 0 },
      strong: { type: Number, default: 0 },
      weak: { type: Number, default: 0 },
      hallucinated: { type: Number, default: 0 },
      unverifiable: { type: Number, default: 0 },
      hallucinationRate: { type: Number, default: 0 },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

contractSchema.virtual('clauses', {
  ref: 'Clause',
  localField: '_id',
  foreignField: 'contractId'
});

contractSchema.virtual('risk_summary').get(function() {
  if (!this.clauses) return null; // Only works if clauses are populated
  
  const breakdown = { low: 0, medium: 0, high: 0, critical: 0 };
  const compBreakdown = { low: 0, medium: 0, high: 0 };
  let hrRecommended = 0;

  for (const c of this.clauses) {
    const risk = c.risk_level || 'low';
    if (breakdown[risk] !== undefined) breakdown[risk]++;

    const compRisk = c.compliance_risk_level || 'low';
    if (compBreakdown[compRisk] !== undefined) compBreakdown[compRisk]++;

    if (c.human_review_strongly_recommended) {
      hrRecommended++;
    }
  }

  return {
    riskBreakdown: breakdown,
    complianceBreakdown: compBreakdown,
    complianceReviewRecommendedCount: hrRecommended
  };
});

module.exports = mongoose.model('Contract', contractSchema);
