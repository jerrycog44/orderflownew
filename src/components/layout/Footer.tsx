import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { OrderFlowLogo } from '../ui/OrderFlowLogo';
import './Footer.css';

interface FooterProps {
  onOpenVendorOnboarding?: () => void;
  onOpenLogisticsOnboarding?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenVendorOnboarding,
  onOpenLogisticsOnboarding,
}) => {
  const navigate = useNavigate();

  const handleVendorClick = () => {
    if (onOpenVendorOnboarding) {
      onOpenVendorOnboarding();
    } else {
      navigate('/signup?role=vendor');
    }
  };

  const handleLogisticsClick = () => {
    if (onOpenLogisticsOnboarding) {
      onOpenLogisticsOnboarding();
    } else {
      navigate('/signup?role=logistics_provider');
    }
  };

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
              The logistics marketplace connecting commercial vendors directly with verified delivery providers. Efficient, transparent, and built for scale.
            </p>
            <div className="of-footer-status">
              <span className="of-status-dot"></span>
              <span className="of-status-text">Platform Operational • Live Routing</span>
            </div>
          </div>

          {/* Navigation Link Groups */}
          <div className="of-footer-links-group">
            <div className="of-footer-col">
              <h4 className="of-footer-heading">Product</h4>
              <ul className="of-footer-list">
                <li><a href="#how-it-works">How It Works</a></li>
                <li><button onClick={handleVendorClick} className="of-footer-btn-link">Create Delivery</button></li>
                <li><a href="#value-proposition">Vendor Benefits</a></li>
                <li><a href="#trust-quality">Marketplace Safety</a></li>
              </ul>
            </div>

            <div className="of-footer-col">
              <h4 className="of-footer-heading">For Businesses</h4>
              <ul className="of-footer-list">
                <li><button onClick={handleVendorClick} className="of-footer-btn-link">Vendor Registration</button></li>
                <li><button onClick={handleLogisticsClick} className="of-footer-btn-link">Logistics Companies</button></li>
                <li><a href="#logistics-providers">Fleet Management</a></li>
                <li><a href="#trust-quality">SLA Guarantee</a></li>
              </ul>
            </div>

            <div className="of-footer-col">
              <h4 className="of-footer-heading">Company & Legal</h4>
              <ul className="of-footer-list">
                <li><a href="#trust-quality">About OrderFlow</a></li>
                <li><a href="#">Security Overview</a></li>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="of-footer-bottom">
          <p className="of-footer-copyright">
            © {new Date().getFullYear()} OrderFlow Logistics Technologies. All rights reserved.
          </p>
          <div className="of-footer-security">
            <ShieldCheck size={16} className="text-muted" />
            <span>Encrypted Platform Core</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
