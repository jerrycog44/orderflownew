import React from 'react';
import { ArrowRight, Download, Globe } from 'lucide-react';
import { ANDROID_APP_URL, isAndroidAppAvailable, useLandingActions } from '../../lib/landingActions';
import './landing.css';

interface AppCtasProps {
  /** `onDark` renders for dark backgrounds (hero / final band). */
  tone?: 'onDark' | 'onLight';
  className?: string;
}

/**
 * The two primary calls to action: "Use on Web" and "Download Android App".
 *
 * The Android button only becomes a real download link when a build URL is
 * configured (VITE_ANDROID_APP_URL). Until then it is rendered as a clearly
 * labelled, non-interactive "Coming soon" state rather than a dead link.
 */
export const AppCtas: React.FC<AppCtasProps> = ({ tone = 'onDark', className = '' }) => {
  const { openWebApp, dashboardPath } = useLandingActions();

  return (
    <div className={`lp-cta-row lp-cta-${tone} ${className}`.trim()}>
      <button type="button" className="lp-btn lp-btn-primary" onClick={openWebApp} data-testid="cta-use-on-web">
        <Globe size={18} aria-hidden="true" />
        <span>{dashboardPath ? 'Open web app' : 'Use on Web'}</span>
        <ArrowRight size={16} aria-hidden="true" />
      </button>

      {isAndroidAppAvailable ? (
        <a
          className="lp-btn lp-btn-secondary"
          href={ANDROID_APP_URL}
          rel="noopener noreferrer"
          data-testid="cta-download-android"
        >
          <Download size={18} aria-hidden="true" />
          <span>Download Android App</span>
        </a>
      ) : (
        <button
          type="button"
          className="lp-btn lp-btn-secondary lp-btn-soon"
          disabled
          aria-disabled="true"
          data-testid="cta-download-android"
        >
          <Download size={18} aria-hidden="true" />
          <span>Download Android App</span>
          <span className="lp-soon-tag">Coming soon</span>
        </button>
      )}
    </div>
  );
};
