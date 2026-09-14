import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import './FinalCtaSection.css';

interface FinalCtaSectionProps {
  onOpenVendorOnboarding?: () => void;
  onOpenLogisticsOnboarding?: () => void;
}

export const FinalCtaSection: React.FC<FinalCtaSectionProps> = ({
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
    <section className="section of-final-cta-section">
      <div className="container">
        <div className="of-final-cta-card">
          <div className="of-final-cta-content">
            <h2 className="of-final-cta-title">
              Ready to move your next order?
            </h2>
            <p className="of-final-cta-desc">
              Create a delivery request now to compare rates from verified logistics providers and schedule your pickup.
            </p>
            <div className="of-final-cta-buttons">
              <Button
                variant="secondary"
                size="lg"
                onClick={handleVendorClick}
                rightIcon={<ArrowRight size={18} />}
              >
                Get Started as Vendor
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleLogisticsClick}
                className="of-btn-cta-dark"
              >
                Join as Logistics Partner
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
