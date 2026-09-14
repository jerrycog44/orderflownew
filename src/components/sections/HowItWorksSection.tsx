import React from 'react';
import { PackagePlus, SlidersHorizontal, Radar, CheckCircle2 } from 'lucide-react';
import { Card } from '../ui/Card';
import './HowItWorksSection.css';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      number: '01',
      title: "Tell us what you're sending",
      description: 'Package/product information and pickup and customer delivery locations.',
      icon: <PackagePlus size={22} className="of-step-icon" />,
    },
    {
      number: '02',
      title: 'Choose a suitable provider',
      description: 'OrderFlow recommends logistics providers based primarily on suitability and current availability.',
      icon: <SlidersHorizontal size={22} className="of-step-icon" />,
    },
    {
      number: '03',
      title: 'Track your delivery',
      description: 'Follow the delivery through its lifecycle from pickup to completion.',
      icon: <Radar size={22} className="of-step-icon" />,
    },
  ];

  return (
    <section id="how-it-works" className="section section-subtle">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Simple Workflow</span>
          <h2 className="section-title">How OrderFlow Works</h2>
          <p className="section-description">
            Three simple steps to arrange and manage your deliveries seamlessly.
          </p>
        </div>

        {/* 3-Step Grid */}
        <div className="of-timeline-grid-3">
          {steps.map((step) => (
            <Card key={step.number} className="of-step-card" padding="lg">
              <div className="of-step-card-header">
                <span className="of-step-num">{step.number}</span>
                <div className="of-step-icon-wrapper">{step.icon}</div>
              </div>
              <h3 className="of-step-title">{step.title}</h3>
              <p className="of-step-desc">{step.description}</p>
            </Card>
          ))}
        </div>

        {/* Concise Provider Recommendation Highlight */}
        <div className="of-rec-card">
          <div className="of-rec-header">
            <h3 className="of-rec-title">Find the right logistics provider.</h3>
            <p className="of-rec-sub">OrderFlow helps match your delivery with suitable providers on the platform.</p>
          </div>

          <div className="of-rec-bullets">
            <div className="of-rec-bullet">
              <CheckCircle2 size={16} className="of-rec-check" />
              <span><strong>Suitable for your package</strong> (dimensions, weight, special handling)</span>
            </div>
            <div className="of-rec-bullet">
              <CheckCircle2 size={16} className="of-rec-check" />
              <span><strong>Available for the delivery</strong> (coverage area & active fleet)</span>
            </div>
            <div className="of-rec-bullet">
              <CheckCircle2 size={16} className="of-rec-check" />
              <span><strong>Reviews & ratings</strong> when enough delivery history exists</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
