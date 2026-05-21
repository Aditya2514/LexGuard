import React, { useState, useEffect } from 'react';
import { getProfile, createOrder, verifyPayment } from '../api/lexguardClient';

export default function PricingPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getProfile().then(profile => {
      setUser(profile.user);
    }).catch(() => {
      // User not logged in, redirect to login
      window.location.href = '/login';
    });
  }, []);

  const handleSubscribe = async (planName) => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Create Order on Backend
      const { order, keyId } = await createOrder(planName);

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'LexGuard',
        description: `Upgrade to LexGuard ${planName.toUpperCase()}`,
        order_id: order.id,
        handler: async function (response) {
          try {
            // 3. Verify Payment on Backend
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: planName
            });
            alert('Payment successful! Your plan has been upgraded.');
            window.location.href = '/dashboard';
          } catch (err) {
            alert('Verification failed: ' + err.message);
          }
        },
        prefill: {
          email: user.email,
        },
        theme: {
          color: '#1a73e8' // Modern blue
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        alert('Payment failed. Please try again.');
      });
      rzp.open();
    } catch (err) {
      alert(err.message || 'Failed to initiate payment.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="loading-state">Loading...</div>;

  return (
    <div className="pricing-container">
      <div className="pricing-header">
        <h1>Simple, transparent pricing</h1>
        <p>Protect your business from predatory contracts with AI.</p>
      </div>

      <div className="pricing-cards">
        {/* Free Tier */}
        <div className={`pricing-card ${user.plan === 'free' ? 'active-plan' : ''}`}>
          <h3>Free</h3>
          <div className="price">₹0<span>/month</span></div>
          <ul className="features">
            <li>✓ 3 Contract analyses / month</li>
            <li>✓ Basic Risk Flagging</li>
            <li>✓ Indian Law DB Access</li>
          </ul>
          <button className="pricing-btn secondary" disabled>
            {user.plan === 'free' ? 'Current Plan' : 'Free Plan'}
          </button>
        </div>

        {/* Pro Tier */}
        <div className={`pricing-card popular ${user.plan === 'pro' ? 'active-plan' : ''}`}>
          <div className="popular-badge">Most Popular</div>
          <h3>Pro</h3>
          <div className="price">₹499<span>/month</span></div>
          <ul className="features">
            <li>✓ 30 Contract analyses / month</li>
            <li>✓ Adversarial Judge Quality Pass</li>
            <li>✓ Export to Word/PDF</li>
            <li>✓ Priority Processing</li>
          </ul>
          <button 
            className="pricing-btn primary" 
            onClick={() => handleSubscribe('pro')}
            disabled={loading || user.plan === 'pro' || user.plan === 'enterprise'}
          >
            {loading ? 'Processing...' : user.plan === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
          </button>
        </div>

        {/* Enterprise Tier */}
        <div className={`pricing-card ${user.plan === 'enterprise' ? 'active-plan' : ''}`}>
          <h3>Enterprise</h3>
          <div className="price">₹1,999<span>/month</span></div>
          <ul className="features">
            <li>✓ Unlimited analyses</li>
            <li>✓ API Access</li>
            <li>✓ Multi-user Workspaces</li>
            <li>✓ Dedicated Account Manager</li>
          </ul>
          <button 
            className="pricing-btn secondary" 
            onClick={() => handleSubscribe('enterprise')}
            disabled={loading || user.plan === 'enterprise'}
          >
            {loading ? 'Processing...' : user.plan === 'enterprise' ? 'Current Plan' : 'Upgrade to Enterprise'}
          </button>
        </div>
      </div>
    </div>
  );
}
