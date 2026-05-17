import RiskBadge from './RiskBadge';
import './ContractSummary.css';

export default function ContractSummary({ contract, riskSummary }) {
  const breakdown = riskSummary?.riskBreakdown || {};

  return (
    <div className="contract-summary glass-card fade-in" id="contract-summary">
      <div className="summary-header">
        <div>
          <h1 className="summary-filename">{contract?.originalFileName || 'Contract'}</h1>
          <div className="summary-meta">
            <span className="meta-clauses">{contract?.totalClauses || 0} clauses</span>
            <span className="meta-separator">·</span>
            <span className="meta-status">{contract?.status}</span>
          </div>
        </div>
        <div className="summary-risk-main">
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

      {/* Compliance breakdown under Indian Law ( ICA, DPDP, Arbitration ) */}
      <div className="compliance-panel glass-panel">
        <h4 className="compliance-panel-title">🇮🇳 Indian Law Compliance Summary</h4>
        <div className="compliance-breakdown">
          <ComplianceCount label="Low Risk" count={riskSummary?.complianceBreakdown?.low || 0} level="low" />
          <ComplianceCount label="Med Risk" count={riskSummary?.complianceBreakdown?.medium || 0} level="medium" />
          <ComplianceCount label="High Risk" count={riskSummary?.complianceBreakdown?.high || 0} level="high" />
        </div>
        {riskSummary?.complianceReviewRecommendedCount > 0 && (
          <div className="compliance-alert-pill animate-pulse" id="compliance-lawyer-alert">
            <span>⚠️ Human review strongly recommended for {riskSummary.complianceReviewRecommendedCount} clause{riskSummary.complianceReviewRecommendedCount > 1 ? 's' : ''} under Indian Law.</span>
          </div>
        )}
      </div>

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
