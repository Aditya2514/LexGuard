import './RiskBadge.css';

const RISK_COLORS = {
  low: 'risk-low',
  medium: 'risk-medium',
  high: 'risk-high',
  critical: 'risk-critical',
};

export default function RiskBadge({ riskLevel }) {
  const cls = RISK_COLORS[riskLevel] || 'risk-pending';
  const label = riskLevel || 'pending';

  return (
    <span className={`badge risk-badge ${cls}`} id={`risk-badge-${label}`}>
      {label}
    </span>
  );
}
