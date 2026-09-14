import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import './LogisticsProviderSection.css';

interface LogisticsProviderSectionProps {
  onOpenLogisticsOnboarding?: () => void;
}

export const LogisticsProviderSection: React.FC<LogisticsProviderSectionProps> = ({
  onOpenLogisticsOnboarding,
}) => {
  const navigate = useNavigate();

  const handleProviderClick = () => {
    if (onOpenLogisticsOnboarding) {
      onOpenLogisticsOnboarding();
    } else {
      navigate('/signup?role=logistics_provider');
    }
  };

  return (
    <section id="logistics-providers" className="section of-logistics-section">
      <div className="container">
        <div className="of-logistics-card">
          <div className="of-logistics-content">
            <div className="of-logistics-badge">
              <Truck size={14} />
              <span>For Logistics Providers</span>
            </div>

            <h2 className="of-logistics-title">
              Are you a logistics provider?
            </h2>

            <p className="of-logistics-description">
              Join OrderFlow and receive delivery opportunities from vendors who need your service.
            </p>

            <div className="of-logistics-cta">
              <Button
                variant="secondary"
                size="lg"
                onClick={handleProviderClick}
                rightIcon={<ArrowRight size={18} />}
              >
                Become a provider
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
