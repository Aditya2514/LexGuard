const mongoose = require('mongoose');

const rewriteFeedbackSchema = new mongoose.Schema(
  {
    clauseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clause',
      required: true,
      index: true
    },
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      required: true,
      index: true
    },
    approved: {
      type: Boolean,
      required: true // true for 👍, false for 👎
    },
    userComment: {
      type: String,
      default: null
    },
    originalText: {
      type: String,
      required: true
    },
    rewrittenText: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RewriteFeedback', rewriteFeedbackSchema);
