import { Outlet } from 'react-router-dom';
import './AppLayout.css';

export default function AppLayout() {
  return (
    <div className="app-layout">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-inner">
          <a href="/" className="logo" id="app-logo">
            <span className="logo-icon">⚖</span>
            <span className="logo-text">LexGuard</span>
          </a>
          <span className="header-tag">AI Contract Intelligence</span>
        </div>
      </header>

      {/* ── Disclaimer Banner ── */}
      <div className="disclaimer-banner" id="disclaimer-banner">
        <span className="disclaimer-icon">ℹ</span>
        <span>
          LexGuard is an informational tool only. It does not provide legal advice.
          Always consult a qualified lawyer before making legal decisions.
        </span>
      </div>

      {/* ── Main Content ── */}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
