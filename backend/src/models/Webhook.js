const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetUrl: {
      type: String,
      required: true,
      trim: true,
      match: [/^https?:\/\//, 'Please provide a valid HTTP or HTTPS URL'],
    },
    events: {
      type: [String],
      enum: ['contract.analyzed', 'contract.failed'],
      default: ['contract.analyzed'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    secret: {
      type: String,
      default: null, // Optional signature secret for enterprise users
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Webhook', webhookSchema);
