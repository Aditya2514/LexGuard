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

    // ── Phase 2: Agent 1 – Clause Extractor ──────────────────────────────
    clause_type: {
      type: String,
      enum: [...CLAUSE_TYPES, null],
      default: null,
    },
    category_tags: { type: [String], default: [] },

    // ── Phase 2: Agent 2 – Risk Analyst ──────────────────────────────────
    risk_level: {
      type: String,
      enum: [...RISK_LEVELS, null],
      default: null,
    },
    risk_score: { type: Number, min: 0, max: 10, default: null },
    risk_reasons: { type: [String], default: [] },
    possible_law_references: { type: [lawReferenceSchema], default: [] },

    // ── Phase 3: Agent 3 – User Advocate ─────────────────────────────────
    plain_language_explanation: { type: String, default: null },
    worst_case_scenario: { type: String, default: null },
    negotiation_tip: { type: String, default: null },

    // ── Phase 4: Agent 4 – Indian Compliance Checker ──────────────────────
    compliance_risk_level: {
      type: String,
      enum: [...COMPLIANCE_RISK_LEVELS, null],
      default: null,
    },
    potential_issue_areas: { type: [String], default: [] },
    human_review_strongly_recommended: { type: Boolean, default: null },
    explanatory_note: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Clause', clauseSchema);
