const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free',
  },
  monthlyQuota: {
    type: Number,
    default: 3, // 3 free contracts per month
  },
  usedThisMonth: {
    type: Number,
    default: 0,
  },
  quotaResetDate: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  },
  apiKey: {
    type: String,
    default: () => require('crypto').randomUUID(),
  },
  // Razorpay fields (for Phase 4)
  razorpayCustomerId: { type: String, default: null },
  razorpaySubscriptionId: { type: String, default: null },
  planExpiresAt: { type: Date, default: null },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// Method to check password validity
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
