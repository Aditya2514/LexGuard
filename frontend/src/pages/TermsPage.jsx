import React from 'react';

export default function TermsPage() {
  return (
    <div className="page-container fade-in">
      <h1 className="section-heading">Terms and Conditions</h1>
      <div className="glass-card" style={{ padding: '2rem' }}>
        <p><strong>Last Updated:</strong> May 21, 2026</p>
        <br />
        <h3>1. Acceptance of Terms</h3>
        <p>By accessing or using LexGuard, you agree to be bound by these Terms and Conditions. If you do not agree, do not use the service.</p>
        <br />
        <h3>2. Description of Service</h3>
        <p>LexGuard provides an AI-powered contract analysis tool. It is an informational tool only and does not constitute legal advice.</p>
        <br />
        <h3>3. User Accounts</h3>
        <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials.</p>
        <br />
        <h3>4. Disclaimer of Warranties</h3>
        <p>LexGuard is provided "as is" without any warranties. We do not guarantee that the AI analysis is completely accurate, error-free, or a substitute for professional legal counsel.</p>
        <br />
        <h3>5. Limitation of Liability</h3>
        <p>In no event shall LexGuard be liable for any indirect, incidental, special, or consequential damages arising out of your use of the service.</p>
      </div>
    </div>
  );
}
