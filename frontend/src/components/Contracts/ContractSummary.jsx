import RiskBadge from './RiskBadge';
import FinancialExposureCard from './FinancialExposureCard';
import './ContractSummary.css';

export default function ContractSummary({ contract, riskSummary }) {
  const breakdown = riskSummary?.riskBreakdown || {
    low: 0, medium: 0, high: 0, critical: 0
  };
  
  const compBreakdown = riskSummary?.complianceBreakdown || {
    low: 0, medium: 0, high: 0
  };

  const hrRecommendedCount = riskSummary?.complianceReviewRecommendedCount || 0;

  return (
    <div className={`contract-summary glass-card fade-in risk-border-${contract?.overallRiskLevel || 'low'}`} id="contract-summary">
      <div className="summary-header">
        <div>
          <h1 className="summary-filename">{contract?.originalFileName || 'Contract'}</h1>
          <div className="summary-meta">
            <span className="meta-clauses">{contract?.totalClauses || 0} clauses</span>
            <span className="meta-separator">·</span>
            <span className="meta-status">{contract?.status}</span>
            {contract?.globalContext?.jurisdiction && (
              <>
                <span className="meta-separator">·</span>
                <span className="meta-jurisdiction" style={{ color: '#0ea5e9', fontWeight: 'bold' }}>
                  📍 {contract.globalContext.jurisdiction}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="summary-risk-main tour-risk-badge">
          <span className="risk-label">Overall Risk</span>
          <RiskBadge riskLevel={contract?.overallRiskLevel} />
        </div>
      </div>

      <div className="risk-breakdown">
        <RiskCount label="Low" count={breakdown.low || 0} level="low" />
        <RiskCount label="Medium" count={breakdown.medium || 0} level="medium" />
        <RiskCount label="High" count={breakdown.high || 0} level="high" />
        <RiskCount label="Critical" count={breakdown.critical || 0} level="critical" />
      </div>

      {/* Render Agent 4 Financial Obligations */}
      <FinancialExposureCard 
        financialObligations={contract?.financial_obligations || []} 
        totalExposure={contract?.total_financial_exposure || 0} 
      />

      {/* Compliance breakdown under Indian Law ( ICA, DPDP, Arbitration ) */}
      <div className="compliance-panel glass-panel">
        <h4 className="compliance-panel-title">🇮🇳 Indian Law Compliance Summary</h4>
        <div className="compliance-breakdown">
          <ComplianceCount label="Low Risk" count={compBreakdown.low || 0} level="low" />
          <ComplianceCount label="Med Risk" count={compBreakdown.medium || 0} level="medium" />
          <ComplianceCount label="High Risk" count={compBreakdown.high || 0} level="high" />
        </div>
        {hrRecommendedCount > 0 && (
          <div className="compliance-alert-pill animate-pulse" id="compliance-lawyer-alert">
            <span>⚠️ Human review strongly recommended for {hrRecommendedCount} clause{hrRecommendedCount > 1 ? 's' : ''} under Indian Law.</span>
          </div>
        )}
      </div>

      {/* Citation statistics categorical breakdown */}
      {contract?.citationStats && contract.citationStats.totalCitations > 0 && (
        <div className="citation-panel glass-panel">
          <h4 className="citation-panel-title">⚖️ Indian Law Citation Accuracy</h4>
          
          <div className="citation-accuracy-gauge-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <div className="citation-accuracy-value-label">
                Weighted Accuracy: <span className="citation-accuracy-number">{contract.citationStats.avgAccuracy}%</span>
              </div>
              <div className="citation-accuracy-bar-bg">
                <div 
                  className={`citation-accuracy-bar-fill ${
                    contract.citationStats.avgAccuracy >= 85 ? 'good' :
                    contract.citationStats.avgAccuracy >= 60 ? 'warning' : 'poor'
                  }`}
                  style={{ width: `${contract.citationStats.avgAccuracy}%` }}
                />
              </div>
            </div>

            <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
              <div className="citation-accuracy-value-label">
                Hallucination Rate: <span className="citation-accuracy-number" style={{ color: (contract.citationStats.hallucinationRate || 0) > 0 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>{contract.citationStats.hallucinationRate || 0}%</span>
              </div>
            </div>
          </div>

          <div className="citation-breakdown">
            <div className="citation-count citation-count-strong">
              <span className="citation-count-number">{contract.citationStats.strong || 0}</span>
              <span className="citation-count-label">Strong (Verified)</span>
            </div>
            <div className="citation-count citation-count-weak">
              <span className="citation-count-number">{contract.citationStats.weak || 0}</span>
              <span className="citation-count-label">Weak (Case Law)</span>
            </div>
            <div className="citation-count citation-count-unverifiable">
              <span className="citation-count-number">{contract.citationStats.unverifiable || 0}</span>
              <span className="citation-count-label">Unverifiable</span>
            </div>
            <div className="citation-count citation-count-hallucinated">
              <span className="citation-count-number">{contract.citationStats.hallucinated || 0}</span>
              <span className="citation-count-label">Hallucinated</span>
            </div>
          </div>
        </div>
      )}

      <p className="summary-disclaimer">
        This summary highlights clauses that may carry risk. It is informational only and not legal advice.
      </p>
    </div>
  );
}

function RiskCount({ label, count, level }) {
  return (
    <div className={`risk-count risk-count-${level}`}>
      <span className="risk-count-number">{count}</span>
      <span className="risk-count-label">{label}</span>
    </div>
  );
}

function ComplianceCount({ label, count, level }) {
  return (
    <div className={`compliance-count compliance-count-${level}`}>
      <span className="compliance-count-number">{count}</span>
      <span className="compliance-count-label">{label}</span>
    </div>
  );
}
