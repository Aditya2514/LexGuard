import { useState } from 'react';

export default function FinancialExposureCard({ financialObligations = [], totalExposure = 0 }) {
  const [expanded, setExpanded] = useState(false);

  // If there's no financial exposure, we can just return null or a minimal safe banner
  if (totalExposure === 0 && financialObligations.length === 0) {
    return (
      <div className="glass-panel" style={{ marginTop: '1rem', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #10b981', backgroundColor: '#f0fdf4' }}>
        <h4 style={{ margin: 0, color: '#065f46', fontSize: '0.95rem' }}>💰 Financial Exposure: Zero hidden penalties detected.</h4>
      </div>
    );
  }

  // Format currency dynamically based on the first item's currency, defaulting to INR
  const primaryCurrency = financialObligations[0]?.currency || 'INR';
  const formattedTotal = new Intl.NumberFormat('en-IN', { style: 'currency', currency: primaryCurrency, maximumFractionDigits: 0 }).format(totalExposure);

  return (
    <div className="glass-panel" style={{ 
      marginTop: '1rem', 
      padding: '1rem', 
      borderRadius: '8px', 
      borderLeft: '4px solid #ef4444', 
      backgroundColor: '#fef2f2' 
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div>
          <h4 style={{ margin: 0, color: '#991b1b', fontSize: '1rem', fontWeight: 'bold' }}>⚠️ Total Financial Exposure</h4>
          <span style={{ color: '#b91c1c', fontSize: '1.25rem', fontWeight: 'bold' }}>{formattedTotal}</span>
        </div>
        <button style={{ 
          background: 'none', 
          border: 'none', 
          color: '#991b1b', 
          fontWeight: 'bold', 
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)'
        }}>
          {expanded ? 'Hide Breakdown ↑' : 'View Breakdown ↓'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(239, 68, 68, 0.2)', paddingTop: '0.75rem' }}>
          <p style={{ fontSize: '0.85rem', color: '#7f1d1d', marginBottom: '0.5rem', fontWeight: '600' }}>
            Agent 4 explicitly extracted {financialObligations.length} hidden obligation(s):
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#7f1d1d', fontSize: '0.9rem' }}>
            {financialObligations.map((obl, idx) => (
              <li key={idx} style={{ marginBottom: '0.25rem' }}>
                <strong>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: obl.currency || 'INR', maximumFractionDigits: 0 }).format(obl.amount)}</strong> - {obl.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
