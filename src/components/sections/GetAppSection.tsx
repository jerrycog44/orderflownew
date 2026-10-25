import React from 'react';
import { Smartphone, Globe } from 'lucide-react';
import { AppCtas } from './AppCtas';
import { isAndroidAppAvailable } from '../../lib/landingActions';
import './landing.css';

export const GetAppSection: React.FC = () => (
  <section id="get-the-app" className="lp-section lp-final" aria-labelledby="get-app-title">
    <div className="container">
      <div className="lp-final-card">
        <h2 id="get-app-title" className="lp-h2 lp-on-dark">Ready to move your next order?</h2>
        <p className="lp-lead lp-on-dark-muted">
          Start on the web today. {isAndroidAppAvailable
            ? 'The Android app is available to download.'
            : 'The Android app is on the way — the web app already works great on your phone.'}
        </p>

        <AppCtas tone="onDark" />

        <ul className="lp-final-points">
          <li><Globe size={16} aria-hidden="true" /> Works in any modern browser</li>
          <li><Smartphone size={16} aria-hidden="true" /> Designed mobile-first</li>
        </ul>
      </div>
    </div>
  </section>
);
