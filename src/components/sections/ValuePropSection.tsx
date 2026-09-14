import React from 'react';
import { Building2, Scale, Zap, Eye } from 'lucide-react';
import { Card } from '../ui/Card';
import './ValuePropSection.css';

export const ValuePropSection: React.FC = () => {
  const valuePillars = [
    {
      title: 'One place for logistics',
      description: 'Stop contacting logistics providers individually. Access multiple verified fleets and courier services through a single unified marketplace.',
      icon: <Building2 size={24} className="of-prop-icon" />,
    },
    {
      title: 'Compare transparent options',
      description: 'Make informed business decisions by comparing upfront pricing, estimated transit times, fleet capabilities, and service ratings.',
      icon: <Scale size={24} className="of-prop-icon" />,
    },
    {
      title: 'Less operational friction',
      description: 'Create delivery jobs in minutes with standardized package specifications, pickup scheduling, and automated provider assignment.',
      icon: <Zap size={24} className="of-prop-icon" />,
    },
    {
      title: 'Complete delivery visibility',
      description: 'Eliminate customer check-in calls. Track active deliveries from pickup to final dropoff with clear milestone notifications.',
      icon: <Eye size={24} className="of-prop-icon" />,
    },
  ];

  return (
    <section id="value-proposition" className="section">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Built for Commercial Vendors</span>
          <h2 className="section-title">Designed for Commercial Logistics Management</h2>
          <p className="section-description">
            OrderFlow simplifies physical product distribution so you can focus on growing your core business.
          </p>
        </div>

        <div className="of-prop-grid">
          {valuePillars.map((pillar) => (
            <Card key={pillar.title} className="of-prop-card" padding="lg" bordered hoverable>
              <div className="of-prop-header">
                <div className="of-prop-icon-box">{pillar.icon}</div>
              </div>
              <h3 className="of-prop-title">{pillar.title}</h3>
              <p className="of-prop-desc">{pillar.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
