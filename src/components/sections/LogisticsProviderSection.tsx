import React from 'react';
import { Truck, ArrowRight } from 'lucide-react';
import { useLandingActions } from '../../lib/landingActions';
import './landing.css';

export const LogisticsProviderSection: React.FC = () => {
  const { signUpAsProvider } = useLandingActions();

  return (
    <section id="logistics-providers" className="lp-section lp-section-tint" aria-labelledby="providers-title">
      <div className="container">
        <div className="lp-band">
          <div>
            <span className="lp-kicker lp-kicker-light">
              <Truck size={14} aria-hidden="true" /> For logistics providers
            </span>
            <h2 id="providers-title" className="lp-h2 lp-on-dark">Run a fleet or ride solo?</h2>
            <p className="lp-lead lp-on-dark-muted">
              Join OrderFlow to receive delivery opportunities from merchants in your coverage area, accept the jobs
              you want, and keep your availability under your control.
            </p>
          </div>
          <button type="button" className="lp-btn lp-btn-secondary" onClick={signUpAsProvider}>
            <span>Become a provider</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
};
