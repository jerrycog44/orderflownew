import React from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import './TrustSection.css';

export const TrustSection: React.FC = () => {
  return (
    <section id="trust-quality" className="section section-subtle">
      <div className="container">
        <div className="of-compact-trust">
          <div className="of-compact-trust-header">
            <ShieldCheck size={24} color="var(--color-brand)" />
            <h2 className="of-compact-trust-title">
              Built around clarity, reliable delivery workflows, and transparent provider selection.
            </h2>
          </div>

          <div className="of-compact-trust-points">
            <div className="of-trust-point">
              <CheckCircle2 size={16} className="of-trust-point-icon" />
              <span>Clear delivery workflow</span>
            </div>
            <div className="of-trust-point">
              <CheckCircle2 size={16} className="of-trust-point-icon" />
              <span>Suitable provider recommendations</span>
            </div>
            <div className="of-trust-point">
              <CheckCircle2 size={16} className="of-trust-point-icon" />
              <span>One place to manage deliveries</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
