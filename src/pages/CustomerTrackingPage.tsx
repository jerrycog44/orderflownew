import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Search, MapPin, Navigation, Truck, CheckCircle2, Clock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { deliveryService } from '../services/deliveryService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { DeliveryRecord } from '../types';
import './CustomerTrackingPage.css';

const TRACKING_STEPS = [
  { key: 'created', label: 'Order Created' },
  { key: 'provider_selected', label: 'Provider Matched' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
];

const getStepIndex = (status: string): number => {
  switch (status) {
    case 'created':
    case 'searching':
      return 0;
    case 'provider_selected':
    case 'awaiting_pickup':
      return 1;
    case 'in_transit':
      return 2;
    case 'delivered':
      return 3;
    default:
      return 0;
  }
};

export const CustomerTrackingPage: React.FC = () => {
  const { trackingCode } = useParams<{ trackingCode?: string }>();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState(trackingCode || '');
  const [delivery, setDelivery] = useState<DeliveryRecord | null>(() => {
    return trackingCode ? deliveryService.getDeliveryByTrackingCode(trackingCode) : null;
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    const found = deliveryService.getDeliveryByTrackingCode(searchInput.trim());
    setDelivery(found);
    navigate(`/track/${searchInput.trim()}`, { replace: true });
  };

  const currentStep = delivery ? getStepIndex(delivery.status) : 0;

  return (
    <div className="tracking-page-container">
      {/* Header & Search Bar Card */}
      <div className="tracking-header-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Package size={24} color="var(--color-brand-accent)" />
            <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
              OrderFlow Tracking Hub
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} leftIcon={<ArrowLeft size={16} />}>
            Home
          </Button>
        </div>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
          Enter your OrderFlow tracking code (e.g. <code>OF-849201</code>) for real-time delivery status updates.
        </p>

        <form onSubmit={handleSearch} className="tracking-search-bar">
          <input
            type="text"
            className="tracking-search-input"
            placeholder="Enter Order Tracking Code (e.g. OF-849201)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Button variant="primary" type="submit" leftIcon={<Search size={16} />}>
            Track Order
          </Button>
        </form>
      </div>

      {/* Tracking Result View */}
      {delivery ? (
        <div className="tracking-card-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border-default)' }}>
            <div>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-brand-accent)' }}>
                TRACKING CODE: {delivery.id}
              </span>
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: '4px 0 0 0', color: 'var(--color-text-primary)' }}>
                {delivery.productName}
              </h2>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Dispatched by <strong>{delivery.vendorName}</strong>
              </span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <Badge variant={delivery.status === 'delivered' ? 'success' : delivery.status === 'in_transit' ? 'brand' : 'warning'}>
                {delivery.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                Est. Delivery: <strong>{delivery.estimatedDeliveryTime || 'Same Day'}</strong>
              </p>
            </div>
          </div>

          {/* Visual Step Timeline */}
          <div className="tracking-timeline">
            {TRACKING_STEPS.map((step, idx) => {
              const isCompleted = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <div
                  key={step.key}
                  className={`tracking-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                >
                  <div className="tracking-step-dot">
                    {isCompleted ? <CheckCircle2 size={18} /> : idx + 1}
                  </div>
                  <span className="tracking-step-label">{step.label}</span>
                </div>
              );
            })}
          </div>

          {/* Details Grid */}
          <div className="tracking-info-grid">
            <div className="tracking-info-box">
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={14} /> PICKUP ORIGIN
              </span>
              <p style={{ fontWeight: 600, margin: '6px 0 2px 0', fontSize: 'var(--font-size-sm)' }}>
                {delivery.pickup.address}
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                {delivery.pickup.city}
              </p>
            </div>

            <div className="tracking-info-box">
              <span style={{ fontSize: 'var(--font-size-xs)', color: '#10B981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Navigation size={14} /> RECIPIENT DESTINATION
              </span>
              <p style={{ fontWeight: 600, margin: '6px 0 2px 0', fontSize: 'var(--font-size-sm)' }}>
                {delivery.destination.address}
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Recipient: <strong>{delivery.recipient.name}</strong> ({delivery.destination.city})
              </p>
            </div>

            <div className="tracking-info-box">
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Truck size={14} /> LOGISTICS PARTNER
              </span>
              <p style={{ fontWeight: 600, margin: '6px 0 2px 0', fontSize: 'var(--font-size-sm)' }}>
                {delivery.selectedProvider?.name || 'Assigning Partner...'}
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Package: {delivery.package.weightKg} kg ({delivery.package.packageType})
              </p>
            </div>
          </div>
        </div>
      ) : trackingCode ? (
        <div className="tracking-card-section" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
          <Clock size={40} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-3)' }} />
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Tracking Code Not Found
          </h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
            No delivery record was found matching <code>{trackingCode}</code>. Please double-check your code.
          </p>
        </div>
      ) : (
        <div className="tracking-card-section" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
          <ShieldCheck size={40} color="var(--color-brand-accent)" style={{ marginBottom: 'var(--space-3)' }} />
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Instant Public Tracking
          </h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
            Enter a valid OrderFlow tracking number above to see real-time dispatch status.
          </p>
        </div>
      )}
    </div>
  );
};
