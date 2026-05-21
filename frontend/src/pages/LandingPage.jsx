
import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* Background blur decorative circles */}
      <div className="glow-circle glow-1"></div>
      <div className="glow-circle glow-2"></div>
      <div className="glow-circle glow-3"></div>

      {/* Header / Navbar */}
      <nav className="landing-nav fade-in">
        <div className="nav-logo">
          <span className="nav-logo-icon">⚖</span>
          <span className="nav-logo-text">LexGuard</span>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#agents">AI Agents</a>
          <Link to="/dashboard" className="btn btn-primary nav-cta-btn">
            Go to App 🚀
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="landing-hero fade-in">
        <h1 className="hero-title">
          Rights & <span className="highlight-text">Indian Compliance</span> Intelligence
        </h1>
        <p className="hero-subtitle">
          LexGuard is an advanced Multi-Agent legal AI engine designed to classify clauses, audit risks, advocate for your interests, and enforce Indian statutory compliance automatically.
        </p>
        <div className="hero-actions">
          <Link to="/dashboard" className="btn btn-primary btn-xl glow-button">
            Launch Analysis Dashboard 🚀
          </Link>
          <a href="#features" className="btn btn-ghost btn-xl">
            Explore AI Agents
          </a>
        </div>
      </header>

      {/* Mock Interactive Upload Component (Matches the user's uploaded mockup perfectly!) */}
      <section className="mock-dashboard-section fade-in">
        <div className="glass-card mock-dashboard-container">
          <div className="mock-upload-panel">
            <div className="panel-header">
              <h2>Audit Your First Contract</h2>
              <p>Upload a PDF or Word document to trigger the multi-agent legal audit sequence.</p>
            </div>
            
            <div className="mock-upload-grid">
              {/* Left Drag & Drop box */}
              <Link to="/dashboard" className="mock-dropzone-link">
                <div className="mock-dropzone">
                  <div className="dropzone-icon">☁️</div>
                  <h3>Drag and drop files here</h3>
                  <span className="or-text">- OR -</span>
                  <div className="btn btn-primary dropzone-btn">Browse Files</div>
                </div>
              </Link>

              {/* Right Audited Files List */}
              <div className="mock-uploaded-files">
                <h3>Recently Audited Contracts</h3>
                <ul className="mock-file-list">
                  <li className="mock-file-item">
                    <div className="file-icon">📄</div>
                    <div className="file-details">
                      <div className="file-meta">
                        <span className="file-name">Employment_Agreement.pdf</span>
                        <span className="file-percent">100% Completed</span>
                      </div>
                      <div className="file-progress-bar">
                        <div className="file-progress-fill p-100"></div>
                      </div>
                    </div>
                  </li>

                  <li className="mock-file-item">
                    <div className="file-icon">💼</div>
                    <div className="file-details">
                      <div className="file-meta">
                        <span className="file-name">Vendor_SLA_Terms.docx</span>
                        <span className="file-percent">100% Completed</span>
                      </div>
                      <div className="file-progress-bar">
                        <div className="file-progress-fill p-100"></div>
                      </div>
                    </div>
                  </li>

                  <li className="mock-file-item">
                    <div className="file-icon">🔒</div>
                    <div className="file-details">
                      <div className="file-meta">
                        <span className="file-name">Mutual_NDA_Draft.pdf</span>
                        <span className="file-percent">100% Completed</span>
                      </div>
                      <div className="file-progress-bar">
                        <div className="file-progress-fill p-100"></div>
                      </div>
                    </div>
                  </li>

                  <li className="mock-file-item">
                    <div className="file-icon">⚖️</div>
                    <div className="file-details">
                      <div className="file-meta">
                        <span className="file-name">Arbitration_Clause_Audit.docx</span>
                        <span className="file-percent">100% Completed</span>
                      </div>
                      <div className="file-progress-bar">
                        <div className="file-progress-fill p-100"></div>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agents Grid */}
      <section id="agents" className="agents-section">
        <h2 className="section-title">The Multi-Agent Legal Mind</h2>
        <p className="section-subtitle">
          Our system deploys four coordinated AI agents to thoroughly analyze and risk-score your contracts.
        </p>

        <div className="agents-grid">
          <div className="glass-card agent-card animate-hover">
            <div className="agent-badge agent-1">Agent 1</div>
            <h3>Clause Classifier</h3>
            <p>
              Parses the entire agreement block-by-block. Dynamically extracts text, identifies parties, and categorizes provisions into standard operational definitions.
            </p>
          </div>

          <div className="glass-card agent-card animate-hover">
            <div className="agent-badge agent-2">Risk Analyzer</div>
            <h3>Risk Auditor</h3>
            <p>
              Performs deep legal risk-assessment for each clause. Ranks provisions by risk severity from <b>Low</b> and <b>Medium</b> up to <b>High</b> and <b>Critical</b> issues.
            </p>
          </div>

          <div className="glass-card agent-card animate-hover">
            <div className="agent-badge agent-3">User Advocate</div>
            <h3>User Advocate</h3>
            <p>
              Explains complex terms in clear, plain language. Outlines realistic worst-case legal scenarios and provides specific, actionable negotiation counter-strategies.
            </p>
          </div>

          <div className="glass-card agent-card animate-hover">
            <div className="agent-badge agent-4">Compliance Checker</div>
            <h3>Indian Compliance</h3>
            <p>
              Flags statutory risks under major Indian frameworks. Scans clauses for inconsistencies with the <b>DPDP Act 2023</b>, <b>Indian Contract Act 1872</b>, and other key provisions.
            </p>
          </div>
        </div>
      </section>

      {/* Tech Highlights */}
      <section id="features" className="highlights-section">
        <div className="highlights-grid">
          <div className="highlight-content">
            <h2>Statutory Indian Law Guardrails</h2>
            <p>
              LexGuard is specifically tailored to the unique regulatory landscape of India. Avoid compliance penalties and contract invalidation under:
            </p>
            <ul className="highlight-list">
              <li>
                <strong>Digital Personal Data Protection (DPDP) Act 2023</strong>: Detects overreaching data processing, missing consent templates, and non-compliant privacy practices.
              </li>
              <li>
                <strong>Section 27 of the Indian Contract Act</strong>: Automatically flags invalid non-compete clauses and absolute trade restrictions.
              </li>
              <li>
                <strong>Arbitration & Conciliation Act</strong>: Identifies biased arbitrator appointment terms and unilateral dispute selection clauses.
              </li>
            </ul>
          </div>
          <div className="glass-card highlight-visual-card">
            <h3>Enterprise-Grade Word Export</h3>
            <p>
              Download rich, fully styled audit reports compatible with <strong>Microsoft Word</strong>, <strong>Google Docs</strong>, and <strong>LibreOffice</strong>.
            </p>
            <div className="visual-report-mock">
              <div className="mock-header">
                <span className="dot dot-r"></span>
                <span className="dot dot-y"></span>
                <span className="dot dot-g"></span>
                <span className="mock-title-bar">lexguard-analysis-report.doc</span>
              </div>
              <div className="mock-content-body">
                <h4 style={{ color: '#10b981', margin: '0 0 5px 0' }}>LEXGUARD CONTRACT AUDIT</h4>
                <p style={{ margin: '0 0 10px 0', fontSize: '9pt', opacity: 0.7 }}>Ingested: Employment_Agreement.pdf</p>
                <div style={{ padding: '8px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '6px', fontSize: '8.5pt' }}>
                  <strong>Clause 3 (Non-Compete):</strong> Flags potential restraint of trade issues under Section 27 of the Indian Contract Act, 1872.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Footer Banner */}
      <section className="cta-footer-banner fade-in">
        <div className="glass-card cta-banner-card">
          <h2>Ready to secure your contracts?</h2>
          <p>Get instant insight into your rights, obligations, and Indian compliance risks in less than 30 seconds.</p>
          <Link to="/dashboard" className="btn btn-primary btn-xl glow-button">
            Enter App Dashboard 🚀
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} LexGuard Inc. AI Rights & Contract Intelligence System. All rights reserved.</p>
      </footer>
    </div>
  );
}
