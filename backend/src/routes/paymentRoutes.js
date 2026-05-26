const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Initialize Razorpay
// This will fail gracefully if keys aren't provided yet
let razorpayInstance = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// Plan definitions
const PLANS = {
  pro: { amount: 49900, name: 'Pro Plan', quota: 30 }, // ₹499.00
  enterprise: { amount: 199900, name: 'Enterprise Plan', quota: 99999 } // ₹1999.00
};

// @route   POST /api/payments/create-order
// @desc    Create a Razorpay order for subscription/plan upgrade
// @access  Private
router.post('/create-order', protect, asyncHandler(async (req, res) => {
  if (!razorpayInstance) {
    throw new ApiError(503, 'Payments are not configured on the server yet.');
  }

  const { plan } = req.body; // 'pro' or 'enterprise'
  
  if (!PLANS[plan]) {
    throw new ApiError(400, 'Invalid plan selected.');
  }

  const shortId = req.user._id.toString().slice(-4);
  const options = {
    amount: PLANS[plan].amount, // amount in the smallest currency unit (paise)
    currency: 'INR',
    receipt: `rcpt_${shortId}_${Date.now()}`,
    notes: {
      userId: req.user._id.toString(),
      plan: plan
    }
  };

  try {
    const order = await razorpayInstance.orders.create(options);
    res.json({
      success: true,
      order,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    throw new ApiError(500, 'Failed to create payment order.');
  }
}));

// @route   POST /api/payments/verify
// @desc    Verify payment signature and upgrade user
// @access  Private
router.post('/verify', protect, asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
    throw new ApiError(400, 'Missing payment verification parameters.');
  }

  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new ApiError(503, 'Payment verification is not configured on the server.');
  }

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');

  const isAuthentic = expectedSignature === razorpay_signature;

  if (isAuthentic) {
    // Payment verified, upgrade user
    const targetPlan = PLANS[plan];
    if (!targetPlan) throw new ApiError(400, 'Invalid plan.');

    const user = await User.findById(req.user._id);
    user.plan = plan;
    user.monthlyQuota = targetPlan.quota;
    user.usedThisMonth = 0; // Reset usage on upgrade
    user.quotaResetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    
    // In a real app, save subscription details
    user.razorpaySubscriptionId = razorpay_payment_id; 
    
    await user.save();

    res.json({
      success: true,
      message: 'Payment verified and plan upgraded successfully.',
      user: {
        plan: user.plan,
        monthlyQuota: user.monthlyQuota,
        usedThisMonth: user.usedThisMonth
      }
    });
  } else {
    throw new ApiError(400, 'Invalid payment signature. Verification failed.');
  }
}));

module.exports = router;
