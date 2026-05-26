import React from 'react';

export default function CrossRefAudit({ contract }) {
  if (!contract) return null;

  const findings = contract.crossRefFindings || [];
  const summary = contract.crossRefAuditSummary || 'No audit summary available.';

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-primary)' }}>
          🔍 Cross-Reference & Definitions Audit
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          {summary}
        </p>
      </div>

      {findings.length === 0 ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✅</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No drafting errors found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Agent 9 did not detect any broken cross-references or undefined terms.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {findings.map((f, i) => (
            <div 
              key={i} 
              className="glass-card" 
              style={{ 
                padding: '1.25rem', 
                borderLeft: f.severity === 'high' ? '4px solid var(--risk-critical)' : 
                            f.severity === 'medium' ? '4px solid var(--risk-high)' : 
                            '4px solid var(--risk-medium)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span style={{ 
                  fontWeight: '600', 
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                  fontSize: '0.85rem',
                  letterSpacing: '0.05em',
                  background: 'rgba(255,255,255,0.1)',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}>
                  {f.type.replace('_', ' ')}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  📍 {f.location_hint}
                </span>
              </div>
              
              <p style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>
                {f.issue_text}
              </p>
              
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <strong style={{ color: '#10b981', display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Recommendation:</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{f.recommendation}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
