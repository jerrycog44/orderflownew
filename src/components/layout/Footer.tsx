import React from 'react';
import { Link } from 'react-router-dom';
import { OrderFlowLogo } from '../ui/OrderFlowLogo';
import { isAndroidAppAvailable, ANDROID_APP_URL, useLandingActions } from '../../lib/landingActions';
import './Footer.css';

export const Footer: React.FC = () => {
  const { openWebApp, signUpAsVendor, signUpAsProvider, goToSection } = useLandingActions();

  return (
    <footer className="of-footer">
      <div className="container">
        <div className="of-footer-grid">
          {/* Brand Info Column */}
          <div className="of-footer-brand">
            <Link to="/" className="of-logo" aria-label="OrderFlow Home">
              <OrderFlowLogo size={28} variant="dark" showText={true} />
            </Link>
            <p className="of-footer-tagline">
              A logistics marketplace connecting merchants with logistics providers and riders — from delivery
              request to proof of delivery.
            </p>
          </div>

          {/* Navigation Link Groups */}
          <div className="of-footer-links-group">
            <div className="of-footer-col">
              <h4 className="of-footer-heading">Product</h4>
              <ul className="of-footer-list">
                <li><Link to="/track">Track a delivery</Link></li>
                <li><button onClick={() => goToSection('how-it-works')} className="of-footer-btn-link">How it works</button></li>
                <li><button onClick={() => goToSection('features')} className="of-footer-btn-link">Features</button></li>
                <li><button onClick={openWebApp} className="of-footer-btn-link">Use on Web</button></li>
                <li>
                  {isAndroidAppAvailable ? (
                    <a href={ANDROID_APP_URL} rel="noopener noreferrer">Download Android App</a>
                  ) : (
                    <span className="of-footer-muted">Android app — coming soon</span>
                  )}
                </li>
              </ul>
            </div>

            <div className="of-footer-col">
              <h4 className="of-footer-heading">Get started</h4>
              <ul className="of-footer-list">
                <li><button onClick={signUpAsVendor} className="of-footer-btn-link">Merchant sign up</button></li>
                <li><button onClick={signUpAsProvider} className="of-footer-btn-link">Provider sign up</button></li>
                <li><Link to="/login">Sign in</Link></li>
              </ul>
            </div>

            <div className="of-footer-col">
              <h4 className="of-footer-heading">Legal</h4>
              <ul className="of-footer-list">
                <li><Link to="/privacy">Privacy Policy</Link></li>
                <li><Link to="/terms">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="of-footer-bottom">
          <p className="of-footer-copyright">
            © {new Date().getFullYear()} OrderFlow Logistics Technologies. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
