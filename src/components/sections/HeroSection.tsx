import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { OrderPreviewVisual } from './OrderPreviewVisual';
import './HeroSection.css';

interface HeroSectionProps {
  onOpenVendorOnboarding?: () => void;
  onOpenLogisticsOnboarding?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenVendorOnboarding,
}) => {
  const navigate = useNavigate();

  const handleVendorClick = () => {
    if (onOpenVendorOnboarding) {
      onOpenVendorOnboarding();
    } else {
      navigate('/signup?role=vendor');
    }
  };

  const handleJoinClick = () => {
    navigate('/signup');
  };

  return (
    <section className="of-hero-section">
      <div className="container">
        <div className="of-hero-grid">
          {/* Left Column: Messaging & Actions */}
          <div className="of-hero-content">
            <div className="of-hero-pill">
              <ShieldCheck size={14} className="of-pill-icon" />
              <span>Logistics Marketplace Platform</span>
            </div>

            <h1 className="of-hero-headline">
              Deliver smarter with <span className="of-highlight-text">OrderFlow.</span>
            </h1>

            <p className="of-hero-subhead">
              Connect with suitable logistics providers, manage deliveries, and stay updated from one simple platform — including WhatsApp.
            </p>

            <div className="of-hero-cta-group">
              <Button
                variant="primary"
                size="lg"
                onClick={handleVendorClick}
                rightIcon={<ArrowRight size={18} />}
              >
                Create a delivery
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleJoinClick}
              >
                Join OrderFlow
              </Button>
            </div>

            {/* Micro Trust Bullet Points */}
            <div className="of-hero-trust-bullets">
              <div className="of-trust-item">
                <CheckCircle2 size={16} className="of-trust-check" />
                <span>Suitable Recommendations</span>
              </div>
              <div className="of-trust-item">
                <CheckCircle2 size={16} className="of-trust-check" />
                <span>Available Fleets</span>
              </div>
              <div className="of-trust-item">
                <CheckCircle2 size={16} className="of-trust-check" />
                <span>WhatsApp Sync</span>
              </div>
            </div>
          </div>

          {/* Right Column: Product Visual */}
          <div className="of-hero-visual-col">
            <OrderPreviewVisual onGetStarted={handleVendorClick} />
          </div>
        </div>
      </div>
    </section>
  );
};
