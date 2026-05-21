import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getContracts } from '../../api/lexguardClient';
import RiskBadge from './RiskBadge';
import './ContractList.css';

function StatusBadge({ status }) {
  const cls = `status-${status || 'processing'}`;
  return <span className={`badge ${cls}`}>{status || 'processing'}</span>;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

import AnalyticsDashboard from './AnalyticsDashboard';

export default function ContractList({ refreshKey }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // eslint-disable-next-line
    setLoading(true);
    getContracts()
      .then((data) => {
        setContracts(Array.isArray(data) ? data : []);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="contract-list-loading">
        <span className="spinner" /> Loading contracts…
      </div>
    );
  }

  if (error) {
    return <p className="contract-list-error">{error}</p>;
  }

  if (contracts.length === 0) {
    return (
      <div className="contract-list-empty glass-card fade-in">
        <p className="empty-icon">📄</p>
        <p>No contracts uploaded yet.</p>
        <p className="empty-hint">Upload your first contract above to get started.</p>
      </div>
    );
  }

  return (
    <>
      <AnalyticsDashboard contracts={contracts} />
      <div className="contract-list glass-card fade-in" id="contract-list">
      <table className="data-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Status</th>
            <th>Risk</th>
            <th>Clauses</th>
            <th>Uploaded</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => (
            <tr key={c._id} id={`contract-row-${c._id}`}>
              <td className="file-name-cell">{c.originalFileName}</td>
              <td><StatusBadge status={c.status} /></td>
              <td><RiskBadge riskLevel={c.overallRiskLevel} /></td>
              <td>{c.totalClauses}</td>
              <td className="date-cell">{formatDate(c.uploadedAt)}</td>
              <td>
                <Link
                  to={`/contracts/${c._id}`}
                  className="btn btn-ghost btn-sm"
                  id={`view-contract-${c._id}`}
                >
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
