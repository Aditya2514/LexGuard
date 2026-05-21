import { Outlet } from 'react-router-dom';
import './AppLayout.css';

export default function AppLayout() {
  return (
    <div className="app-layout">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-inner">
          <a href="/dashboard" className="logo" id="app-logo">
            <span className="logo-icon">⚖</span>
            <span className="logo-text">LexGuard</span>
          </a>
          <nav className="header-nav">
            <a href="/dashboard">Dashboard</a>
            <a href="/pricing" className="upgrade-link">Upgrade Plan</a>
            <a href="#" onClick={() => { localStorage.removeItem('lexguard_token'); window.location.href='/login'; }}>Logout</a>
          </nav>
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

      {/* ── Footer ── */}
      <footer style={{ padding: '2rem', textAlign: 'center', borderTop: '1px solid var(--glass-border)', marginTop: 'auto', display: 'flex', gap: '1rem', justifyContent: 'center', fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
        <span>&copy; 2026 LexGuard</span>
        <a href="/terms" style={{ color: 'var(--text-muted)' }}>Terms</a>
        <a href="/privacy" style={{ color: 'var(--text-muted)' }}>Privacy</a>
        <a href="/refund" style={{ color: 'var(--text-muted)' }}>Refund Policy</a>
        <a href="/contact" style={{ color: 'var(--text-muted)' }}>Contact Us</a>
      </footer>
    </div>
  );
}
