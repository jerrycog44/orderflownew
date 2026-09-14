import React, { useState } from 'react';
import { Package, MapPin, CheckCircle2, ArrowRight, ShieldCheck, Clock, Star } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import './OrderPreviewVisual.css';

export const OrderPreviewVisual: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(2);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('provider-1');

  const providers = [
    {
      id: 'provider-1',
      name: 'Apex Express Logistics',
      rating: 4.9,
      reviews: 340,
      eta: '2.5 Hours (Same Day)',
      price: '$48.50',
      badge: 'Best Value',
      recommended: true,
      sla: 'Guaranteed 99.4% On-Time',
    },
    {
      id: 'provider-2',
      name: 'Metro Freight Freightlines',
      rating: 4.8,
      reviews: 512,
      eta: '4.0 Hours (Same Day)',
      price: '$39.00',
      badge: 'Economy',
      recommended: false,
      sla: 'Standard Handling',
    },
    {
      id: 'provider-3',
      name: 'SwiftPulse Courier Services',
      rating: 4.9,
      reviews: 180,
      eta: '1.2 Hours (Priority)',
      price: '$65.00',
      badge: 'Express Priority',
      recommended: false,
      sla: 'Direct Dedicated Courier',
    },
  ];

  return (
    <div className="of-hero-card-widget">
      {/* Widget Header Bar */}
      <div className="of-widget-header">
        <div className="of-widget-controls">
          <span className="of-widget-dot dot-red"></span>
          <span className="of-widget-dot dot-yellow"></span>
          <span className="of-widget-dot dot-green"></span>
          <span className="of-widget-title-badge">OrderFlow Dispatch Engine v2.4</span>
        </div>
        <div className="of-widget-status-pill">
          <span className="of-status-ping"></span>
          <span>Live Provider Network Active</span>
        </div>
      </div>

      {/* Step Progress Selector */}
      <div className="of-widget-tabs">
        <button
          className={`of-widget-tab ${activeStep === 1 ? 'is-active' : ''}`}
          onClick={() => setActiveStep(1)}
        >
          <span className="of-tab-num">1</span>
          <span>Package & Locations</span>
        </button>
        <button
          className={`of-widget-tab ${activeStep === 2 ? 'is-active' : ''}`}
          onClick={() => setActiveStep(2)}
        >
          <span className="of-tab-num">2</span>
          <span>Compare Logistics</span>
        </button>
        <button
          className={`of-widget-tab ${activeStep === 3 ? 'is-active' : ''}`}
          onClick={() => setActiveStep(3)}
        >
          <span className="of-tab-num">3</span>
          <span>Track Delivery</span>
        </button>
      </div>

      {/* Card Content Panel */}
      <div className="of-widget-body">
        {activeStep === 1 && (
          <div className="of-step-pane animate-fade-in">
            <div className="of-pane-section">
              <h4 className="of-pane-subtitle">
                <Package size={16} /> Package Specifications
              </h4>
              <div className="of-spec-grid">
                <div className="of-spec-item">
                  <span className="of-spec-label">Item Category</span>
                  <span className="of-spec-value">Commercial Electronics</span>
                </div>
                <div className="of-spec-item">
                  <span className="of-spec-label">Weight / Dim</span>
                  <span className="of-spec-value">14.2 kg • 40 x 30 x 25 cm</span>
                </div>
                <div className="of-spec-item">
                  <span className="of-spec-label">Handling</span>
                  <span className="of-spec-value text-amber">Fragile • Insured</span>
                </div>
              </div>
            </div>

            <div className="of-route-timeline">
              <div className="of-route-point">
                <div className="of-route-icon pickup-icon">
                  <MapPin size={14} />
                </div>
                <div>
                  <div className="of-route-role">Pickup (Vendor Warehouse)</div>
                  <div className="of-route-address">Building B, Westside Distribution Hub, Sector 4</div>
                </div>
              </div>

              <div className="of-route-connector"></div>

              <div className="of-route-point">
                <div className="of-route-icon dest-icon">
                  <MapPin size={14} />
                </div>
                <div>
                  <div className="of-route-role">Destination (Customer Storefront)</div>
                  <div className="of-route-address">842 Commerce Boulevard, Central Business District</div>
                </div>
              </div>
            </div>

            <div className="of-pane-actions">
              <Button variant="secondary" size="sm" onClick={() => setActiveStep(2)} rightIcon={<ArrowRight size={14} />}>
                View Available Logistics Providers
              </Button>
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="of-step-pane animate-fade-in">
            <div className="of-pane-header-row">
              <div>
                <span className="of-pane-meta">Available Providers for Route #ORD-8942</span>
                <h4 className="of-pane-title">3 Verified Logistics Companies Ready</h4>
              </div>
              <Badge variant="success" size="sm">Real-time Quotes</Badge>
            </div>

            <div className="of-provider-options-list">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className={`of-provider-card ${selectedProviderId === provider.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedProviderId(provider.id)}
                >
                  <div className="of-provider-radio">
                    <span className={`of-radio-inner ${selectedProviderId === provider.id ? 'checked' : ''}`}></span>
                  </div>

                  <div className="of-provider-info">
                    <div className="of-provider-title-row">
                      <h5 className="of-provider-name">{provider.name}</h5>
                      {provider.recommended && (
                        <span className="of-badge-recommended">Recommended</span>
                      )}
                    </div>
                    <div className="of-provider-meta">
                      <span className="of-meta-rating">
                        <Star size={12} fill="#F59E0B" color="#F59E0B" /> {provider.rating} ({provider.reviews})
                      </span>
                      <span>•</span>
                      <span className="of-meta-eta">
                        <Clock size={12} /> {provider.eta}
                      </span>
                    </div>
                    <span className="of-provider-sla">{provider.sla}</span>
                  </div>

                  <div className="of-provider-price">
                    <div className="of-price-amount">{provider.price}</div>
                    <span className="of-price-sub">All-inclusive</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="of-pane-actions-between">
              <span className="of-security-note">
                <ShieldCheck size={14} color="#166534" /> Provider identity & insurance verified by OrderFlow
              </span>
              <Button variant="primary" size="sm" onClick={() => setActiveStep(3)} rightIcon={<ArrowRight size={14} />}>
                Select & Confirm Dispatch
              </Button>
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="of-step-pane animate-fade-in">
            <div className="of-dispatch-success-banner">
              <CheckCircle2 size={24} color="#166534" />
              <div>
                <h4 className="of-dispatch-title">Dispatch Confirmed with Apex Express</h4>
                <p className="of-dispatch-sub">Tracking ID: <strong>OF-TRK-9042-8812</strong></p>
              </div>
            </div>

            <div className="of-live-timeline">
              <div className="of-timeline-item is-done">
                <div className="of-timeline-badge"><CheckCircle2 size={12} /></div>
                <div className="of-timeline-content">
                  <div className="of-timeline-title">Request Created & Matched</div>
                  <div className="of-timeline-time">Today, 09:14 AM</div>
                </div>
              </div>

              <div className="of-timeline-item is-done">
                <div className="of-timeline-badge"><CheckCircle2 size={12} /></div>
                <div className="of-timeline-content">
                  <div className="of-timeline-title">Courier Dispatched for Pickup</div>
                  <div className="of-timeline-time">Today, 09:28 AM • Driver Mark V. (Apex #204)</div>
                </div>
              </div>

              <div className="of-timeline-item is-active">
                <div className="of-timeline-badge pulse-blue"></div>
                <div className="of-timeline-content">
                  <div className="of-timeline-title">In Transit to Destination</div>
                  <div className="of-timeline-time">Estimated Arrival: 11:45 AM (38 mins remaining)</div>
                </div>
              </div>

              <div className="of-timeline-item is-future">
                <div className="of-timeline-badge"></div>
                <div className="of-timeline-content">
                  <div className="of-timeline-title">Delivered & Digital Proof Captured</div>
                  <div className="of-timeline-time">Pending customer signature</div>
                </div>
              </div>
            </div>

            <div className="of-pane-actions">
              <Button variant="outline" size="sm" onClick={onGetStarted}>
                Create Your Delivery Request Now
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
