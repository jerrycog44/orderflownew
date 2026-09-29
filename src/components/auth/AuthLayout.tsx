import React from 'react';
import { Link } from 'react-router-dom';
import { OrderFlowLogo } from '../ui/OrderFlowLogo';
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

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, backLink, maxWidth, className = '' }) => {
  return (
    <div className="of-auth-layout">
      {/* Header */}
      <header className="of-auth-header">
        <Link to="/" className="of-auth-logo" aria-label="OrderFlow Home">
          <OrderFlowLogo size={28} variant="light" showText={true} />
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
          © {new Date().getFullYear()} OrderFlow Logistics Technologies · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link>
        </p>
      </footer>
    </div>
  );
};
