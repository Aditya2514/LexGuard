import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="page-container fade-in">
      <h1 className="section-heading">Privacy Policy</h1>
      <div className="glass-card" style={{ padding: '2rem' }}>
        <p><strong>Last Updated:</strong> May 21, 2026</p>
        <br />
        <h3>1. Information We Collect</h3>
        <p>We collect your email address when you register. We also collect the contract files you upload strictly for the purpose of AI analysis.</p>
        <br />
        <h3>2. How We Use Your Information</h3>
        <p>Your uploaded documents are processed temporarily in memory to extract text and analyze risk. We do not sell your personal data or uploaded contracts to third parties.</p>
        <br />
        <h3>3. Data Security</h3>
        <p>We implement industry-standard security measures, including HTTPS encryption and hashed passwords, to protect your data. All contracts are isolated to your specific tenant ID.</p>
        <br />
        <h3>4. Third-Party Services</h3>
        <p>We use Razorpay for payment processing and do not store your credit card information on our servers. We use Hugging Face for AI inference processing.</p>
        <br />
        <h3>5. Contact Us</h3>
        <p>If you have questions about this Privacy Policy, please contact us via our Contact page.</p>
      </div>
    </div>
  );
}
