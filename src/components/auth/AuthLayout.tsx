import React from 'react';
import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';
import './AuthLayout.css';

interface AuthLayoutProps {
  children: React.ReactNode;
  /** Optional back-link configuration */
  backLink?: { to: string; label: string };
  /** Optional card container max-width override */
  maxWidth?: string;
  /** Optional additional class name for the auth card */
  className?: string;
}

/**
 * Shared layout for all authentication pages.
 * Minimal chrome: logo + content + legal footer.
 * Intentionally simple — the form content is what matters.
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, backLink, maxWidth, className = '' }) => {
  return (
    <div className="of-auth-layout">
      {/* Header */}
      <header className="of-auth-header">
        <Link to="/" className="of-auth-logo" aria-label="OrderFlow Home">
          <div className="of-auth-logo-icon">
            <Truck size={18} color="#FFFFFF" />
          </div>
          <span className="of-auth-logo-text">
            Order<span className="of-auth-logo-accent">Flow</span>
          </span>
        </Link>

        {backLink && (
          <Link to={backLink.to} className="of-auth-back-link">
            ← {backLink.label}
          </Link>
        )}
      </header>

      {/* Main Content */}
      <main className="of-auth-main">
        <div
          className={`of-auth-card ${className}`.trim()}
          style={maxWidth ? { maxWidth } : undefined}
        >
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="of-auth-footer">
        <p>
          © {new Date().getFullYear()} OrderFlow · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link>
        </p>
      </footer>
    </div>
  );
};
