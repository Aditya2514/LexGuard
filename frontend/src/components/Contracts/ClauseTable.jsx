import { useState, useEffect, useMemo } from 'react';
import { getClausesDetailed } from '../../api/lexguardClient';
import { diffWords } from 'diff';
import RiskBadge from './RiskBadge';
import './ClauseTable.css';

const RISK_OPTIONS = ['all', 'low', 'medium', 'high', 'critical'];
const COMPLIANCE_OPTIONS = ['all', 'low', 'medium', 'high'];

export default function ClauseTable({ contractId, contractStatus }) {
  const [clauses, setClauses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [filterRisk, setFilterRisk] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterCompliance, setFilterCompliance] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const limit = 20;

  useEffect(() => {
    if (!contractId) return;
    // eslint-disable-next-line
    if (clauses.length === 0) setLoading(true);
    getClausesDetailed(contractId, page, limit)
      .then((data) => {
        setClauses(data.clauses || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, [contractId, page, contractStatus]);

  // Collect unique clause types for filter
  const clauseTypes = useMemo(() => {
    const types = new Set(clauses.map((c) => c.clause_type).filter(Boolean));
    return ['all', ...Array.from(types).sort()];
  }, [clauses]);

  // Client-side filtering (Search + Risk + Type + Compliance)
  const filtered = useMemo(() => {
    return clauses.filter((c) => {
      if (filterRisk !== 'all' && c.risk_level !== filterRisk) return false;
      if (filterType !== 'all' && c.clause_type !== filterType) return false;
      
      const compLevel = c.compliance_risk_level || 'low';
      if (filterCompliance !== 'all' && compLevel !== filterCompliance) return false;

      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const textMatch = (c.rawText || '').toLowerCase().includes(query);
        const explanationMatch = (c.plain_language_explanation || '').toLowerCase().includes(query);
        const compNoteMatch = (c.explanatory_note || '').toLowerCase().includes(query);
        if (!textMatch && !explanationMatch && !compNoteMatch) return false;
      }

      return true;
    }).sort((a, b) => (a.segmentIndex || 0) - (b.segmentIndex || 0));
  }, [clauses, filterRisk, filterType, filterCompliance, searchQuery]);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="clause-loading">
        <span className="spinner" /> Loading clauses…
      </div>
    );
  }

  if (error) {
    return <p className="clause-error">{error}</p>;
  }

  return (
    <div className="clause-table-wrapper glass-card fade-in tour-clause-table" id="clause-table">
      <div className="clause-table-header">
        <h2 className="section-heading">Clause Analysis</h2>
        <div className="clause-search-bar-wrapper">
          <input
            type="text"
            className="input search-input"
            placeholder="🔍 Search clauses, plain-language notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="clause-search-query"
          />
        </div>
        <div className="clause-filters">
          <select
            className="select filter-select"
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            id="filter-risk-level"
          >
            {RISK_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === 'all' ? 'All Risk Levels' : r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>

          <select
            className="select filter-select"
            value={filterCompliance}
            onChange={(e) => setFilterCompliance(e.target.value)}
            id="filter-compliance-level"
          >
            {COMPLIANCE_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All Compliance Levels' : c.charAt(0).toUpperCase() + c.slice(1) + ' Compliance Risk'}
              </option>
            ))}
          </select>

          <select
            className="select filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            id="filter-clause-type"
          >
            {clauseTypes.map((t) => (
              <option key={t} value={t}>
                {t === 'all' ? 'All Clause Types' : t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="clause-empty">No clauses match the selected filters.</p>
      ) : (
        <table className="data-table clause-data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Risk</th>
              <th>Compliance</th>
              <th>Preview</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((clause) => (
              <ClauseRow
                key={clause._id}
                clause={clause}
                isExpanded={expandedId === clause._id}
                onToggle={() => toggleExpand(clause._id)}
              />
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ← Prev
          </button>
          <span className="page-info">
            Page {page} of {pages} ({total} clauses)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
          >
            Next →
          </button>
        </div>
      )}

      {/* Premium Disclaimer Footnote */}
      <p className="clause-table-footnote">
        ⚖️ <strong>LexGuard Disclaimer:</strong> This analysis is powered by AI and serves strictly for informational and educational purposes. It does not constitute formal legal counsel. For critical contracts or before taking any legal action, consulting a qualified advocate or Indian lawyer is strongly recommended.
      </p>
    </div>
  );
}

/* ── Individual Clause Row ───────────────────────────────────────────── */

function ClauseRow({ clause, isExpanded, onToggle }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(clause.suggested_rewrite);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const preview =
    clause.rawText?.length > 200
      ? clause.rawText.slice(0, 200) + '…'
      : clause.rawText || '';

  const lawCount = clause.possible_law_references?.length || 0;

  return (
    <>
      <tr
        onClick={onToggle}
        className={isExpanded ? 'row-expanded' : ''}
        id={`clause-row-${clause._id}`}
      >
        <td className="clause-idx">{clause.segmentIndex + 1}</td>
        <td className="clause-type-cell">
          <ClauseTypeBadge type={clause.clause_type} />
        </td>
        <td><RiskBadge riskLevel={clause.risk_level} confidenceScore={clause.confidence_score} /></td>
        <td><ComplianceBadge level={clause.compliance_risk_level || 'low'} /></td>
        <td className="clause-preview">{preview}</td>
        <td className="confidence-cell">
          <ConfidenceBadge score={clause.overall_confidence_score} level={clause.overall_confidence_level} />
        </td>
      </tr>

      {isExpanded && (
        <tr className="expanded-row">
          <td colSpan={6}>
            <div className="expanded-content fade-in">
              {/* Full clause text */}
              <div className="expanded-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 className="expanded-label" style={{ margin: 0 }}>Full Clause Text</h4>
                  <button 
                    className="btn btn-ghost"
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem', border: '1px solid var(--accent-color)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('ask-ai-clause', { detail: clause.rawText }));
                    }}
                  >
                    💬 Ask AI About This
                  </button>
                </div>
                <p className="expanded-text">{clause.rawText}</p>
              </div>

              {/* Confidence Breakdown */}
              {clause.overall_confidence_level && (
                <div className="expanded-section">
                  <h4 className="expanded-label">🧠 AI Confidence Breakdown</h4>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <div style={{ background: 'var(--bg-lighter)', padding: '0.75rem', borderRadius: '8px', flex: 1, minWidth: '200px' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Overall Score</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{clause.overall_confidence_score}/100</div>
                      <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{clause.overall_confidence_level} CONFIDENCE</div>
                    </div>
                    <div style={{ flex: 2, minWidth: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <p className="expanded-text" style={{ margin: 0, fontSize: '0.9rem' }}>
                        This score is aggregated from Agent 2 self-reflection, Tier 2 Partner Escalation outcomes, strict Citation Verification, RAG retrieval quality, and Agent 9 cross-reference audits.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Indian law compliance section (Agent 4) */}
              <div className="expanded-section compliance-detail-section">
                <h4 className="expanded-label">⚖️ Indian Law Compliance (Agent 4)</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span className="expanded-compliance-risk-label">Compliance Risk:</span>
                  <ComplianceBadge level={clause.compliance_risk_level || 'low'} />
                  {clause.human_review_strongly_recommended && (
                    <span className="lawyer-review-pill animate-pulse">⚠️ Lawyer Review Recommended</span>
                  )}
                </div>
                
                <p className="expanded-text" style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>
                  {clause.explanatory_note || 'No significant Indian law compliance issues flagged.'}
                </p>

                {clause.potential_issue_areas?.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <span className="expanded-compliance-sublabel">Potential Issue Areas:</span>
                    <ul className="compliance-issues-list">
                      {clause.potential_issue_areas.map((issue, idx) => (
                        <li key={idx} className="compliance-issue-item">{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Risk details */}
              {clause.risk_reasons?.length > 0 && (
                <div className="expanded-section">
                  <h4 className="expanded-label">Risk Reasons</h4>
                  <ul className="risk-reasons-list">
                    {clause.risk_reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Agent 3 – User Advocate */}
              {clause.plain_language_explanation && (
                <div className="expanded-section advocate-section">
                  <h4 className="expanded-label">💬 Plain Language Explanation</h4>
                  <p className="expanded-text">{clause.plain_language_explanation}</p>
                </div>
              )}

              {clause.worst_case_scenario && (
                <div className="expanded-section advocate-section">
                  <h4 className="expanded-label">⚠️ Worst-Case Scenario</h4>
                  <p className="expanded-text">{clause.worst_case_scenario}</p>
                </div>
              )}

              {clause.negotiation_tip && (
                <div className="expanded-section advocate-section">
                  <h4 className="expanded-label">💡 Negotiation Tip</h4>
                  <p className="expanded-text">{clause.negotiation_tip}</p>
                </div>
              )}

              {clause.suggested_rewrite && (
                <div className="expanded-section rewrite-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 className="expanded-label" style={{ marginBottom: 0, color: '#10b981' }}>✍️ Suggested Fair Rewrite (Visual Diff)</h4>
                    <button 
                      className={`copy-rewrite-btn ${isCopied ? 'copied' : ''}`}
                      onClick={handleCopy}
                    >
                      {isCopied ? '✅ Copied!' : '📋 Copy Counter-Clause'}
                    </button>
                  </div>
                  <div className="rewrite-box">
                    <p className="expanded-text" style={{ fontStyle: 'italic', margin: 0, lineHeight: '1.6' }}>
                      {diffWords(clause.rawText || '', clause.suggested_rewrite || '').map((part, index) => {
                        if (part.added) {
                          return <span key={index} className="diff-addition">{part.value}</span>;
                        }
                        if (part.removed) {
                          return <span key={index} className="diff-deletion">{part.value}</span>;
                        }
                        return <span key={index}>{part.value}</span>;
                      })}
                    </p>
                  </div>
                </div>
              )}

              {/* Law references */}
              {clause.possible_law_references?.length > 0 && (
                <div className="expanded-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 className="expanded-label">📜 Indian Law References & Precedents</h4>
                    {clause.citation_accuracy != null && (
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: clause.citation_accuracy >= 80 ? 'rgba(16,185,129,0.15)' : clause.citation_accuracy >= 50 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                        color: clause.citation_accuracy >= 80 ? '#10b981' : clause.citation_accuracy >= 50 ? '#f59e0b' : '#ef4444',
                      }}>
                        Citation Accuracy: {clause.citation_accuracy}%
                      </span>
                    )}
                  </div>
                  <div className="law-refs">
                    {clause.possible_law_references.map((ref, i) => {
                      const isPrecedent = ref.act_key === 'CASE_LAW';
                      const vStatus = ref.verification_status;
                      const verificationBadge = vStatus === 'verified'
                        ? { icon: '✅', label: 'Verified', color: '#10b981' }
                        : vStatus === 'misquoted'
                        ? { icon: '⚠️', label: 'Misquoted', color: '#f59e0b' }
                        : vStatus === 'not_found'
                        ? { icon: '❌', label: 'Not Found', color: '#ef4444' }
                        : vStatus === 'not_applicable'
                        ? { icon: 'ℹ️', label: 'N/A', color: '#6b7280' }
                        : null;

                      return (
                      <div className={`law-ref-card ${isPrecedent ? 'precedent-card' : ''}`} key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div className="law-ref-badge" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isPrecedent ? '#9b59b6' : 'var(--accent-color)' }}>
                             {isPrecedent ? '🏛️ Supreme Court Precedent' : '📜 Statutory Law'}
                          </div>
                          {verificationBadge && (
                            <span title={ref.verification_note || ''} style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '8px',
                              fontSize: '0.7rem',
                              fontWeight: '600',
                              background: `${verificationBadge.color}18`,
                              color: verificationBadge.color,
                              cursor: 'help',
                            }}>
                              {verificationBadge.icon} {verificationBadge.label}
                            </span>
                          )}
                        </div>
                        <a
                          href={ref.reference_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="law-ref-name"
                        >
                          {ref.act_name}
                        </a>
                        {ref.section_hint && (
                          <span className="law-ref-hint">{ref.section_hint}</span>
                        )}
                        {ref.reason && (
                          <p className="law-ref-reason">{ref.reason}</p>
                        )}
                        {ref.verification_note && vStatus !== 'verified' && vStatus !== 'not_applicable' && (
                          <p style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.35rem', fontStyle: 'italic' }}>
                            {ref.verification_note}
                          </p>
                        )}
                      </div>
                    )})}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Compliance Badge Helper ─────────────────────────────────────────── */

function ComplianceBadge({ level }) {
  const norm = (level || 'low').toLowerCase();
  return (
    <span className={`compliance-badge compliance-badge-${norm}`}>
      {norm.toUpperCase()} RISK
    </span>
  );
}

/* ── Taxonomy Type Badge Helper ─────────────────────────────────────────── */

function ClauseTypeBadge({ type }) {
  const normType = (type || 'other').toLowerCase();
  let icon;
  let label = normType.replace(/_/g, ' ');

  switch (normType) {
    case 'non_compete': icon = '🚫'; break;
    case 'intellectual_property': icon = '💡'; break;
    case 'dispute_resolution': icon = '⚖️'; break;
    case 'compensation': icon = '💰'; break;
    case 'force_majeure': icon = '🌪️'; break;
    case 'indemnification': icon = '🛡️'; break;
    case 'termination': icon = '🚪'; break;
    case 'confidentiality': icon = '🤫'; break;
    case 'data_privacy': icon = '🔒'; break;
    case 'disclosure': icon = '🔍'; break;
    case 'timeline_performance': icon = '⏳'; break;
    case 'delivery_possession': icon = '🔑'; break;
    default: icon = '📄'; break;
  }

  return (
    <div className="clause-type-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem', textTransform: 'capitalize' }}>
      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

/* ── Confidence Badge Helper ─────────────────────────────────────────── */

function ConfidenceBadge({ score, level }) {
  if (!level) return <span className="badge" style={{ background: '#374151', color: '#9ca3af', border: '1px solid #4b5563' }}>N/A</span>;
  
  const colors = {
    HIGH: { bg: 'rgba(16,185,129,0.15)', text: '#10b981', icon: '🟢', msg: 'LexGuard is confident in this assessment' },
    MEDIUM: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', icon: '🟡', msg: 'Review recommended — some uncertainty' },
    LOW: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', icon: '🔴', msg: 'Consult a lawyer — LexGuard is uncertain' },
  };

  const c = colors[level] || colors.MEDIUM;
  return (
    <span 
      className="badge confidence-badge" 
      title={`${c.msg} (Score: ${score}/100)`}
      style={{
        background: c.bg,
        color: c.text,
        cursor: 'help',
        border: `1px solid ${c.text}40`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.25rem 0.5rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        whiteSpace: 'nowrap'
      }}
    >
      {c.icon} {level}
    </span>
  );
}
