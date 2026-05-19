import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getContract, getRiskSummary, getClausesDetailed } from '../api/lexguardClient';
import ContractSummary from '../components/Contracts/ContractSummary';
import ClauseTable from '../components/Contracts/ClauseTable';

export default function ContractDetailPage() {
  const { id } = useParams();
  const [contract, setContract] = useState(null);
  const [riskSummary, setRiskSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    let pollInterval = null;
    let consecutiveErrors = 0;

    const fetchData = (showLoading = false) => {
      if (showLoading) setLoading(true);

      Promise.all([getContract(id), getRiskSummary(id)])
        .then(([contractData, summaryData]) => {
          if (!isMounted) return;
          consecutiveErrors = 0; // Reset on success
          setContract(contractData);
          setRiskSummary(summaryData);
          setError('');

          const isAnalyzing = contractData.status === 'processing' || contractData.status === 'pending';
          if (isAnalyzing && !pollInterval) {
            pollInterval = setInterval(() => fetchData(false), 3000);
          } else if (!isAnalyzing && pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          
          // Tolerate transient 502/503 or network ERR_FAILED errors (e.g. Render restarts)
          const isNetworkOr5xx = !err.status || err.status >= 500;
          if (isNetworkOr5xx) {
            consecutiveErrors++;
            if (consecutiveErrors < 15) {
              console.warn(`Transient network error (${consecutiveErrors}/15), retrying...`, err.message);
              // If initial fetch failed on cold start, start polling anyway to recover
              if (!pollInterval) {
                pollInterval = setInterval(() => fetchData(false), 3000);
              }
              return;
            }
          }

          setError(err.message);
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    };

    fetchData(true);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <span className="spinner" style={{ width: '2rem', height: '2rem' }} />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading contract…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <p style={{ color: 'var(--risk-critical)', marginBottom: '1rem' }}>{error}</p>
        <Link to="/dashboard" className="btn btn-ghost">← Back to Contracts</Link>
      </div>
    );
  }

  const handleExportReport = async () => {
    try {
      const detailedData = await getClausesDetailed(id, 1, 1000);
      const clausesList = detailedData.clauses || [];

      // Generate highly styled MS Word compliant HTML content
      let htmlContent = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>LexGuard AI Contract Intelligence Report</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      background-color: #ffffff;
      margin: 0;
      padding: 20px;
    }
    h1 {
      color: #065f46;
      font-size: 24pt;
      margin-top: 0;
      margin-bottom: 5pt;
      border-bottom: 3px solid #10b981;
      padding-bottom: 8px;
    }
    h2 {
      color: #0f172a;
      font-size: 16pt;
      margin-top: 25pt;
      margin-bottom: 10pt;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
    }
    h3 {
      color: #059669;
      font-size: 12pt;
      margin-top: 15pt;
      margin-bottom: 5pt;
    }
    p {
      margin-top: 0;
      margin-bottom: 8pt;
      font-size: 11pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15pt;
      margin-top: 10pt;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 10px 12px;
      text-align: left;
      font-size: 10.5pt;
    }
    th {
      background-color: #f8fafc;
      color: #334155;
      font-weight: bold;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 9.5pt;
    }
    .badge-critical {
      background-color: #fee2e2;
      color: #991b1b;
      border: 1px solid #fca5a5;
    }
    .badge-high {
      background-color: #ffedd5;
      color: #9a3412;
      border: 1px solid #fed7aa;
    }
    .badge-medium {
      background-color: #fef9c3;
      color: #854d0e;
      border: 1px solid #fef08a;
    }
    .badge-low {
      background-color: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    .card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 18pt;
    }
    .clause-header {
      font-size: 12.5pt;
      font-weight: bold;
      color: #1e293b;
      margin-bottom: 8pt;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 4px;
    }
    .law-ref-box {
      background-color: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 10px 12px;
      margin-top: 10pt;
      border-radius: 0 4px 4px 0;
    }
    .disclaimer {
      font-size: 9pt;
      color: #64748b;
      font-style: italic;
      margin-top: 30pt;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      text-align: center;
    }
  </style>
</head>
<body>

  <h1>LEXGUARD CONTRACT ANALYSIS REPORT</h1>
  <p style="font-size: 10pt; color: #64748b;">Generated on: ${new Date().toLocaleString()} | ID: ${id}</p>

  <h2>1. Contract Overview</h2>
  <table>
    <tr>
      <th>File Name</th>
      <td>${contract?.originalFileName || 'Contract Document'}</td>
    </tr>
    <tr>
      <th>Ingestion Status</th>
      <td>${contract?.status === 'done' ? 'Ingestion Success' : 'Ingestion Completed'}</td>
    </tr>
    <tr>
      <th>Total Clauses Parsed</th>
      <td>${contract?.totalClauses || 0} Clauses</td>
    </tr>
    <tr>
      <th>Overall Risk Rating</th>
      <td>
        <span class="badge badge-${(contract?.overallRiskLevel || 'low')}">
          ${(contract?.overallRiskLevel || 'low').toUpperCase()}
        </span>
      </td>
    </tr>
  </table>

  <h2>2. Key Risk Profile</h2>
  <table>
    <thead>
      <tr>
        <th>Risk Tier</th>
        <th>Clause Count</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>🔴 Critical Risk</td>
        <td>${riskSummary?.riskBreakdown?.critical || 0}</td>
      </tr>
      <tr>
        <td>🟠 High Risk</td>
        <td>${riskSummary?.riskBreakdown?.high || 0}</td>
      </tr>
      <tr>
        <td>🟡 Medium Risk</td>
        <td>${riskSummary?.riskBreakdown?.medium || 0}</td>
      </tr>
      <tr>
        <td>🟢 Low Risk</td>
        <td>${riskSummary?.riskBreakdown?.low || 0}</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Indian Regulatory Compliance Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Indian Compliance Category</th>
        <th>Clause Count Flagged</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>🔴 High Risk Legal Issues</td>
        <td>${riskSummary?.complianceBreakdown?.high || 0}</td>
      </tr>
      <tr>
        <td>🟡 Medium Risk Legal Issues</td>
        <td>${riskSummary?.complianceBreakdown?.medium || 0}</td>
      </tr>
      <tr>
        <td>🟢 Low Risk Legal Issues (DPDP, Contract Act)</td>
        <td>${riskSummary?.complianceBreakdown?.low || 0}</td>
      </tr>
    </tbody>
  </table>
  <p style="font-weight: bold; color: #b45309;">
    ⚠️ Lawyer Review Recommendation Index: Professional legal review strongly advised for <u>${riskSummary?.complianceReviewRecommendedCount || 0} clauses</u> matching sensitive Indian statutory criteria.
  </p>

  <h2>4. Detailed Per-Clause Audit</h2>
`;

      clausesList.forEach((c) => {
        const cleanType = (c.clause_type || 'other').replace(/_/g, ' ');
        const riskLevel = c.risk_level || 'low';
        const complianceLevel = c.compliance_risk_level || 'low';

        htmlContent += `
  <div class="card">
    <div class="clause-header">
      Clause #${c.segmentIndex + 1} &mdash; Type: ${cleanType.toUpperCase()}
    </div>
    
    <p><strong>Clause Risk Rating:</strong> 
      <span class="badge badge-${riskLevel}">${riskLevel.toUpperCase()}</span> 
      (Score: ${c.risk_score !== null ? c.risk_score : '—'}/10)
    </p>

    <p><strong>Indian Law Compliance Level:</strong> 
      <span class="badge badge-${complianceLevel}">${complianceLevel.toUpperCase()}</span>
    </p>

    <p><strong>Original Clause Contract Wording:</strong></p>
    <blockquote style="margin: 0; padding: 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-family: Courier, monospace; font-size: 10pt; margin-bottom: 10pt;">
      "${c.rawText}"
    </blockquote>

    <p><strong>Plain Language Summary:</strong></p>
    <p style="color: #475569;">${c.plain_language_explanation || '—'}</p>

    <p><strong>Worst-Case Legal Scenario:</strong></p>
    <p style="color: #991b1b; font-weight: 500;">${c.worst_case_scenario || '—'}</p>

    <p><strong>Negotiation Action Recommendation:</strong></p>
    <p style="color: #0369a1; font-weight: 500;">${c.negotiation_tip || '—'}</p>

    <p><strong>Indian Statutory Compliance Audit Note:</strong></p>
    <p>${c.explanatory_note || 'No significant Indian law compliance issues flagged.'}</p>
`;

        if (c.potential_issue_areas?.length > 0) {
          htmlContent += `
    <p><strong>Potential Issues under Indian Law:</strong></p>
    <ul style="margin: 0; padding-left: 20px; margin-bottom: 10pt;">
      ${c.potential_issue_areas.map(i => `<li>${i}</li>`).join('')}
    </ul>
`;
        }

        if (c.possible_law_references?.length > 0) {
          htmlContent += `
    <div class="law-ref-box">
      <strong>Statutory Framework / Legal Authority Citations:</strong>
      <ul style="margin: 5px 0 0 0; padding-left: 20px;">
        ${c.possible_law_references.map(r => `
          <li>
            <strong>${r.act_name}</strong> ${r.section_hint ? `(${r.section_hint})` : ''} 
            <br/><span style="color: #475569; font-size: 10pt;">Reason: ${r.reason}</span>
          </li>
        `).join('')}
      </ul>
    </div>
`;
        }

        htmlContent += `</div>`;
      });

      htmlContent += `
  <div class="disclaimer">
    <h3>LEGAL & COMPLIANCE DISCLAIMER</h3>
    <p>
      LexGuard Contract Intelligence is an AI tool powered by advanced language modeling. The analysis, risk scores, summaries, and regulatory references provided in this report are for educational and risk-intelligence workflows only, and do not constitute formal legal advice. This report does not establish an attorney-client relationship. Always engage qualified legal counsel licensed in India to review critical contracts before signing.
    </p>
    <p>&copy; ${new Date().getFullYear()} LexGuard Inc. All Rights Reserved.</p>
  </div>

</body>
</html>
`;

      // Add UTF-8 BOM prefix to force MS Word to read characters as UTF-8
      const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/vnd.ms-word;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lexguard-analysis-report-${id}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Could not export report: ${err.message}`);
    }
  };

  const isAnalyzing = contract?.status === 'processing' || contract?.status === 'pending';

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <Link to="/dashboard" className="btn btn-ghost" id="back-to-list">← All Contracts</Link>
        <button 
          className="btn btn-primary" 
          onClick={handleExportReport} 
          id="btn-export-report"
          disabled={isAnalyzing}
        >
          📥 Download Analysis Report
        </button>
      </div>

      {isAnalyzing && (
        <div className="glass-card fade-in" style={{
          padding: '2rem',
          textAlign: 'center',
          marginBottom: '2rem',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(59, 130, 246, 0.05))',
        }}>
          <div className="spinner" style={{ width: '2.5rem', height: '2.5rem', margin: '0 auto 1.5rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.5rem' }}>
            AI Contract Intelligence Running...
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 1.5rem', fontSize: '0.95rem' }}>
            We are extracting contract clauses and performing multi-agent risk analysis (IP ownership, Indian law compliance, and liability audits). This updates in real-time.
          </p>
          <div style={{
            width: '100%',
            maxWidth: '400px',
            height: '6px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '3px',
            margin: '0 auto',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              backgroundColor: '#10b981',
              width: '50%',
              borderRadius: '3px',
              animation: 'progress-loading 1.8s infinite ease-in-out'
            }} />
          </div>
          <style>{`
            @keyframes progress-loading {
              0% { left: -30%; width: 30%; }
              50% { left: 40%; width: 40%; }
              100% { left: 100%; width: 30%; }
            }
          `}</style>
        </div>
      )}

      <ContractSummary contract={contract} riskSummary={riskSummary} />
      <ClauseTable contractId={id} contractStatus={contract?.status} />
    </div>
  );
}
