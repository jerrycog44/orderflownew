import React from 'react';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import './MobileAppShell.css';

export interface MobileAppShellProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  workspaceBadge?: string;
  headerRightAction?: React.ReactNode;
  hideHeader?: boolean;
  customHeader?: React.ReactNode;
  hideBottomNav?: boolean;
  customBottomNav?: React.ReactNode;
  roleOverride?: 'vendor' | 'logistics_provider' | null;
  noPadding?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const MobileAppShell: React.FC<MobileAppShellProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  workspaceBadge,
  headerRightAction,
  hideHeader = false,
  customHeader,
  hideBottomNav = false,
  customBottomNav,
  roleOverride,
  noPadding = false,
  children,
  className = '',
}) => {
  return (
    <div className={`of-m-shell ${className}`} data-testid="mobile-app-shell">
      <div className="of-m-shell-frame">
        {/* Header */}
        {!hideHeader && (
          customHeader || (
            <MobileHeader
              title={title || 'OrderFlow'}
              subtitle={subtitle}
              showBack={showBack}
              onBack={onBack}
              workspaceBadge={workspaceBadge}
              rightAction={headerRightAction}
            />
          )
        )}

        {/* Scrollable Content Viewport */}
        <main
          className={`of-m-shell-content ${hideBottomNav ? 'no-bottom-nav' : ''} ${
            noPadding ? 'no-padding' : ''
          }`}
          role="main"
          data-testid="mobile-shell-main"
        >
          {children}
        </main>

        {/* Bottom Navigation */}
        {!hideBottomNav && (
          customBottomNav || (
            <MobileBottomNav roleOverride={roleOverride} />
          )
        )}
      </div>
    </div>
  );
};
