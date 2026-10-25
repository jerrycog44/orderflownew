import React from 'react';
import { KeyRound, Camera, Radio, EyeOff, Banknote, Search } from 'lucide-react';
import { useLandingActions } from '../../lib/landingActions';
import './landing.css';

const SAFEGUARDS = [
  {
    icon: KeyRound,
    title: 'PIN-verified handover',
    description: 'A delivery is only completed once the 4-digit PIN from the recipient is entered.',
  },
  {
    icon: Camera,
    title: 'Optional photo proof',
    description: 'Merchants can require the rider to capture a handover photo before completing.',
  },
  {
    icon: Radio,
    title: 'Live status updates',
    description: 'Dashboards and tracking pages update as the delivery moves through each stage.',
  },
  {
    icon: EyeOff,
    title: 'Recipient privacy',
    description: 'Customer phone numbers and exact addresses stay hidden from riders until a job is accepted.',
  },
  {
    icon: Banknote,
    title: 'Cash on delivery support',
    description: 'Riders see a clear collection reminder, and payment is marked collected at handover.',
  },
  {
    icon: Search,
    title: 'Public tracking',
    description: 'Anyone with a tracking code can check progress without creating an account.',
  },
];

export const TrustSection: React.FC = () => {
  const { goToSection } = useLandingActions();

  return (
    <section id="trust-quality" className="lp-section" aria-labelledby="trust-title">
      <div className="container">
        <header className="lp-section-head">
          <span className="lp-kicker">Delivery you can follow</span>
          <h2 id="trust-title" className="lp-h2">Clear at every step, secure at handover</h2>
          <p className="lp-lead">
            Everything below is part of the OrderFlow workflow today.{' '}
            <button type="button" className="lp-inline-link" onClick={() => goToSection('get-the-app')}>
              Get started
            </button>
          </p>
        </header>

        <ul className="lp-grid-3">
          {SAFEGUARDS.map(({ icon: Icon, title, description }) => (
            <li key={title} className="lp-card">
              <span className="lp-card-icon"><Icon size={20} aria-hidden="true" /></span>
              <h3 className="lp-h4">{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
