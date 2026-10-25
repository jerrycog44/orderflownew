import React from 'react';
import { Store, Bike, CheckCircle2 } from 'lucide-react';
import { useLandingActions } from '../../lib/landingActions';
import './landing.css';

const MERCHANT_POINTS = [
  'Step-by-step delivery form with validation',
  'Smart Dispatch or manual provider selection',
  'Delivery list with status filters and search',
  'Cash on delivery or prepaid, with optional photo proof',
];

const RIDER_POINTS = [
  'Online, Busy and Offline availability control',
  'Targeted delivery offers with Accept and Decline',
  'Active jobs with simple status updates',
  'Earnings calculated from completed deliveries',
];

export const FeaturesSection: React.FC = () => {
  const { signUpAsVendor, signUpAsProvider } = useLandingActions();

  return (
    <section id="features" className="lp-section lp-section-tint" aria-labelledby="features-title">
      <div className="container">
        <header className="lp-section-head">
          <span className="lp-kicker">Two workspaces</span>
          <h2 id="features-title" className="lp-h2">Built for both sides of every delivery</h2>
          <p className="lp-lead">Merchants and riders each get a focused, mobile-friendly workspace.</p>
        </header>

        <div className="lp-split">
          <article className="lp-panel">
            <span className="lp-panel-icon"><Store size={22} aria-hidden="true" /></span>
            <h3 className="lp-h3">For merchants</h3>
            <p className="lp-panel-sub">Send orders to customers without chasing couriers.</p>
            <ul className="lp-checklist">
              {MERCHANT_POINTS.map((point) => (
                <li key={point}><CheckCircle2 size={18} aria-hidden="true" />{point}</li>
              ))}
            </ul>
            <button type="button" className="lp-btn lp-btn-outline" onClick={signUpAsVendor}>
              Create a merchant account
            </button>
          </article>

          <article className="lp-panel lp-panel-dark">
            <span className="lp-panel-icon"><Bike size={22} aria-hidden="true" /></span>
            <h3 className="lp-h3">For riders &amp; providers</h3>
            <p className="lp-panel-sub">Receive delivery opportunities that fit your coverage area.</p>
            <ul className="lp-checklist">
              {RIDER_POINTS.map((point) => (
                <li key={point}><CheckCircle2 size={18} aria-hidden="true" />{point}</li>
              ))}
            </ul>
            <button type="button" className="lp-btn lp-btn-secondary" onClick={signUpAsProvider}>
              Join as a provider
            </button>
          </article>
        </div>
      </div>
    </section>
  );
};
