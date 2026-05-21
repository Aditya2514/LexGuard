import React from 'react';

export default function RefundPage() {
  return (
    <div className="page-container fade-in">
      <h1 className="section-heading">Refund and Cancellation Policy</h1>
      <div className="glass-card" style={{ padding: '2rem' }}>
        <p><strong>Last Updated:</strong> May 21, 2026</p>
        <br />
        <h3>1. Subscriptions & Cancellations</h3>
        <p>LexGuard operates on a monthly subscription model. You may cancel your subscription at any time through your dashboard. Upon cancellation, your access to the premium tier will remain active until the end of your current billing cycle.</p>
        <br />
        <h3>2. No Refunds</h3>
        <p>Due to the nature of our digital AI services and the compute costs incurred, <strong>all sales are final and non-refundable</strong>. We do not offer prorated refunds for canceled subscriptions or unused quota.</p>
        <br />
        <h3>3. Exceptions</h3>
        <p>If you are charged in error due to a technical glitch, please contact us within 7 days of the transaction for a full refund of the erroneous charge.</p>
        <br />
        <h3>4. Account Termination</h3>
        <p>If we terminate your account due to a violation of our Terms and Conditions, no refund will be issued.</p>
      </div>
    </div>
  );
}
