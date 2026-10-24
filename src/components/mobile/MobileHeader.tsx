import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './MobileHeader.css';

export interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  workspaceBadge?: string;
  rightAction?: React.ReactNode;
  className?: string;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  workspaceBadge,
  rightAction,
  className = '',
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className={`of-m-header ${className}`} role="banner">
      <div className="of-m-header-inner">
        <div className="of-m-header-left">
          {showBack && (
            <button
              type="button"
              className="of-m-header-back-btn"
              onClick={handleBack}
              aria-label="Go back"
              data-testid="mobile-header-back-btn"
            >
              <ArrowLeft size={22} strokeWidth={2.2} />
            </button>
          )}
        </div>

        <div className="of-m-header-title-wrapper">
          <div className="of-m-header-title-row">
            <h1 className="of-m-header-title" data-testid="mobile-header-title">
              {title}
            </h1>
            {workspaceBadge && (
              <span className="of-m-header-role-badge" data-testid="mobile-header-badge">
                {workspaceBadge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="of-m-header-subtitle" data-testid="mobile-header-subtitle">
              {subtitle}
            </p>
          )}
        </div>

        <div className="of-m-header-right">
          {rightAction}
        </div>
      </div>
    </header>
  );
};
