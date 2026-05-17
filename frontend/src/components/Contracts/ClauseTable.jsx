import { useState, useEffect, useMemo } from 'react';
import { getClausesDetailed } from '../../api/lexguardClient';
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
    });
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
    <div className="clause-table-wrapper glass-card fade-in" id="clause-table">
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
              <th>Law Hints</th>
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
          {(clause.clause_type || 'other').replace(/_/g, ' ')}
        </td>
        <td><RiskBadge riskLevel={clause.risk_level} /></td>
        <td><ComplianceBadge level={clause.compliance_risk_level || 'low'} /></td>
        <td className="clause-preview">{preview}</td>
        <td className="law-count">
          {lawCount > 0 ? `${lawCount} hint${lawCount > 1 ? 's' : ''}` : '—'}
        </td>
      </tr>

      {isExpanded && (
        <tr className="expanded-row">
          <td colSpan={6}>
            <div className="expanded-content fade-in">
              {/* Full clause text */}
              <div className="expanded-section">
                <h4 className="expanded-label">Full Clause Text</h4>
                <p className="expanded-text">{clause.rawText}</p>
              </div>

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

              {/* Law references */}
              {clause.possible_law_references?.length > 0 && (
                <div className="expanded-section">
                  <h4 className="expanded-label">📜 Indian Law References</h4>
                  <div className="law-refs">
                    {clause.possible_law_references.map((ref, i) => (
                      <div className="law-ref-card" key={i}>
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
                      </div>
                    ))}
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
