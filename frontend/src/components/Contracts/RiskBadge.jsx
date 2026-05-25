import './RiskBadge.css';

const RISK_COLORS = {
  low: 'risk-low',
  medium: 'risk-medium',
  high: 'risk-high',
  critical: 'risk-critical',
};

export default function RiskBadge({ riskLevel, confidenceScore }) {
  const cls = RISK_COLORS[riskLevel] || 'risk-pending';
  const label = riskLevel || 'pending';

  let confidenceIndicator = null;
  if (confidenceScore) {
    if (confidenceScore <= 4) {
      confidenceIndicator = <span title="Low AI Confidence - Human review advised" style={{ marginLeft: '4px', opacity: 0.6 }}>⚠️</span>;
    } else if (confidenceScore <= 8) {
      confidenceIndicator = <span title="Medium AI Confidence" style={{ marginLeft: '4px', opacity: 0.8 }}>⚡</span>;
    }
  }

  return (
    <span className={`badge risk-badge ${cls}`} id={`risk-badge-${label}`}>
      {label}
      {confidenceIndicator}
    </span>
  );
}
