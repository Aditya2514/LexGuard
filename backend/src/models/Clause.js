const mongoose = require('mongoose');
const { CLAUSE_TYPES, RISK_LEVELS, COMPLIANCE_RISK_LEVELS } = require('../config/constants');

// Embedded sub-schema for Indian law references (populated by Agent 2)
const lawReferenceSchema = new mongoose.Schema(
  {
    act_key: { type: String },
    act_name: { type: String },
    section_hint: { type: String },
    reason: { type: String },
    reference_url: { type: String },
  },
  { _id: false }
);

const clauseSchema = new mongoose.Schema(
  {
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      required: [true, 'Contract ID is required'],
      index: true,
    },
    segmentIndex: {
      type: Number,
      required: [true, 'Segment index is required'],
    },
    rawText: {
      type: String,
      required: [true, 'Raw clause text is required'],
    },
    embedding: {
      type: [Number],
      default: null, // Stores 384-dimensional vector from HF all-MiniLM-L6-v2
    },

    // ── Phase 2: Agent 1 – Clause Extractor ──────────────────────────────
    // NOTE: null is intentional default for all agent fields.
    // Mongoose enum does not natively support null values, so we use custom validators.
    clause_type: {
      type: String,
      default: null,
      validate: {
        validator: (v) => v === null || CLAUSE_TYPES.includes(v),
        message: (props) => `"${props.value}" is not a valid clause_type.`,
      },
    },
    category_tags: { type: [String], default: [] },

    // ── Phase 2: Agent 2 – Risk Analyst ──────────────────────────────────
    has_commercial_asymmetry: { type: Boolean, default: null },
    survives_termination: { type: Boolean, default: null },
    risk_level: {
      type: String,
      default: null,
      validate: {
        validator: (v) => v === null || RISK_LEVELS.includes(v),
        message: (props) => `"${props.value}" is not a valid risk_level.`,
      },
    },
    risk_score: { type: Number, min: 0, max: 10, default: null },
    confidence_score: { type: Number, min: 1, max: 10, default: null },
    risk_reasons: { type: [String], default: [] },
    possible_law_references: { type: [lawReferenceSchema], default: [] },

    // ── Phase 3: Agent 3 – User Advocate ─────────────────────────────────
    plain_language_explanation: { type: String, default: null },
    worst_case_scenario: { type: String, default: null },
    negotiation_tip: { type: String, default: null },
    suggested_rewrite: { type: String, default: null },

    // ── Phase 4: Agent 4 – Indian Compliance Checker ──────────────────────
    compliance_risk_level: {
      type: String,
      default: null,
      validate: {
        validator: (v) => v === null || COMPLIANCE_RISK_LEVELS.includes(v),
        message: (props) => `"${props.value}" is not a valid compliance_risk_level.`,
      },
    },
    potential_issue_areas: { type: [String], default: [] },
    human_review_strongly_recommended: { type: Boolean, default: null },
    explanatory_note: { type: String, default: null },

    // ── Phase 5: Agent 6 – Adversary (Red-Teaming) ───────────────────────
    adversarial_warning: { type: String, default: null },
    hardened_rewrite: { type: String, default: null },

    // ── Phase 6: Agent 8 – The Drafter (Auto-Redlining) ──────────────────
    rewritten_text: { type: String, default: null },
  },
  { timestamps: true }
);

// ── Compound Indexes for Production Performance ──────────────────────────────
// Prevents in-memory sorts on paginated clause queries (contractId + segmentIndex).
// Enables fast risk-level filtering for dashboard aggregation (contractId + risk_level).
clauseSchema.index({ contractId: 1, segmentIndex: 1 });
clauseSchema.index({ contractId: 1, risk_level: 1 });

module.exports = mongoose.model('Clause', clauseSchema);
