import React from 'react';
import { PackagePlus, UserCheck, Route } from 'lucide-react';
import './landing.css';

const STEPS = [
  {
    number: '01',
    icon: PackagePlus,
    title: 'Create the delivery',
    description: 'Add the package, pickup and drop-off locations, and the recipient. Your details are kept as you move between steps.',
  },
  {
    number: '02',
    icon: UserCheck,
    title: 'Get matched with a rider',
    description: 'Let Smart Dispatch offer the job to the best-matched available provider, or choose a provider yourself.',
  },
  {
    number: '03',
    icon: Route,
    title: 'Track to handover',
    description: 'Follow each status change from pickup to delivery. The recipient confirms the handover with a 4-digit PIN.',
  },
];

export const HowItWorksSection: React.FC = () => (
  <section id="how-it-works" className="lp-section" aria-labelledby="how-title">
    <div className="container">
      <header className="lp-section-head">
        <span className="lp-kicker">How it works</span>
        <h2 id="how-title" className="lp-h2">From request to doorstep in three steps</h2>
        <p className="lp-lead">One workflow for merchants, providers and the people receiving the package.</p>
      </header>

      <ol className="lp-steps">
        {STEPS.map(({ number, icon: Icon, title, description }) => (
          <li key={number} className="lp-step">
            <div className="lp-step-top">
              <span className="lp-step-icon">
                <Icon size={22} aria-hidden="true" />
              </span>
              <span className="lp-step-num" aria-hidden="true">{number}</span>
            </div>
            <h3 className="lp-h3">{title}</h3>
            <p>{description}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);
