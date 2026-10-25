import React from 'react';
import { ShieldCheck, Zap, Radio, KeyRound, Banknote } from 'lucide-react';
import { AppCtas } from './AppCtas';
import { OrderPreviewVisual } from './OrderPreviewVisual';
import { useLandingActions } from '../../lib/landingActions';
import './landing.css';

const HIGHLIGHTS = [
  { icon: Zap, label: 'Smart Dispatch' },
  { icon: Radio, label: 'Live status updates' },
  { icon: KeyRound, label: 'PIN-verified handover' },
  { icon: Banknote, label: 'Cash on delivery' },
];

export const HeroSection: React.FC = () => {
  const { goToSection } = useLandingActions();

  return (
    <section className="lp-hero" aria-labelledby="hero-title">
      <div className="lp-hero-glow" aria-hidden="true" />
      <div className="lp-hero-grid-bg" aria-hidden="true" />

      <div className="container lp-hero-inner">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">
            <ShieldCheck size={14} aria-hidden="true" />
            Logistics marketplace for merchants &amp; riders
          </span>

          <h1 id="hero-title" className="lp-hero-title">
            Deliver smarter,
            <br />
            from pickup to <span className="lp-gradient-text">proof of delivery.</span>
          </h1>

          <p className="lp-hero-sub">
            OrderFlow connects merchants with logistics providers and riders. Create a delivery in minutes, get
            matched with an available rider, and follow every status change until the customer confirms the handover.
          </p>

          <AppCtas tone="onDark" />

          <button type="button" className="lp-text-link" onClick={() => goToSection('how-it-works')}>
            See how it works
          </button>

          <ul className="lp-highlights" aria-label="Platform highlights">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-hero-visual">
          <OrderPreviewVisual />
        </div>
      </div>
    </section>
  );
};
