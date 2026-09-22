import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MapPin, Truck, CheckCircle2, AlertCircle } from 'lucide-react';
import type { DeliveryRecord } from '../types';
import { deliveryService } from '../services/deliveryService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import './VendorDeliveryDetailPage.css';

const TIMELINE_STEPS = [
  { key: 'created', label: 'Order Created' },
  { key: 'opportunity_sent', label: 'Opportunity Sent' },
  { key: 'provider_selected', label: 'Provider Matched' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
];

export const VendorDeliveryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<DeliveryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const record = deliveryService.getDeliveryById(id);
      setDelivery(record);
    }
    setIsLoading(false);
  }, [id]);

  if (isLoading) {
    return (
      <div style={{ maxWidth: '800px', margin: 'var(--space-12) auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading delivery details...</p>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div style={{ maxWidth: '600px', margin: 'var(--space-12) auto', textAlign: 'center' }}>
        <AlertCircle size={48} color="var(--color-warning)" style={{ marginBottom: 'var(--space-3)' }} />
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Delivery Not Found
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
          We could not locate a delivery request with ID "{id}".
        </p>
        <Button variant="primary" onClick={() => navigate('/vendor/dashboard')}>
          Back to Vendor Dashboard
        </Button>
      </div>
    );
  }

  const getStepStatusIndex = (status: string) => {
    switch (status) {
      case 'draft':
      case 'created':
        return 0;
      case 'provider_selected':
        return 1;
      case 'awaiting_pickup':
        return 2;
      case 'in_transit':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 2;
    }
  };

  const currentStepIdx = getStepStatusIndex(delivery.status);

  return (
    <div className="of-delivery-detail-container">
      <button
        type="button"
        className="of-create-delivery-back-link"
        onClick={() => navigate('/vendor/dashboard')}
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      {/* Header Info */}
      <div className="of-delivery-detail-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-text-primary)', margin: 0 }}>
              {delivery.id}
            </h1>
            <Badge variant={delivery.status === 'delivered' ? 'success' : delivery.status === 'in_transit' ? 'brand' : 'neutral'}>
              {delivery.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
            Created on {new Date(delivery.createdAt).toLocaleDateString()} at {new Date(delivery.createdAt).toLocaleTimeString()}
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => navigate('/vendor/deliveries/create')}>
          + New Delivery Request
        </Button>
      </div>

      {/* Status Timeline */}
      <div className="of-delivery-status-timeline">
        {TIMELINE_STEPS.map((step, idx) => {
          const isCompleted = idx < currentStepIdx;
          const isActive = idx === currentStepIdx;

          return (
            <React.Fragment key={step.key}>
              <div className={`of-timeline-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                <div className="of-timeline-icon">
                  {isCompleted ? <CheckCircle2 size={16} /> : idx + 1}
                </div>
                <span className="of-timeline-label">{step.label}</span>
              </div>
              {idx < TIMELINE_STEPS.length - 1 && (
                <div className={`of-timeline-line ${idx < currentStepIdx ? 'completed' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Main Grid Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Logistics Partner & Price */}
        <div
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}
        >
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Truck size={20} color="var(--color-brand-accent)" />
            Logistics Provider
          </h2>

          {delivery.selectedProvider ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <img
                  src={delivery.selectedProvider.logoUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100'}
                  alt={delivery.selectedProvider.name}
                  style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', objectFit: 'cover' }}
                />
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                    {delivery.selectedProvider.name}
                  </h3>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Est. Transit: {delivery.estimatedDeliveryTime}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Total Delivery Fare
                </span>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-brand-accent)' }}>
                  ₦{delivery.estimatedPrice.toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Searching for matching logistics provider...
            </p>
          )}
        </div>

        {/* Route Details */}
        <div
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}
        >
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <MapPin size={20} color="var(--color-brand-accent)" />
            Route & Contacts
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Pickup Address
              </span>
              <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {delivery.pickup.address} ({delivery.pickup.city})
              </p>
            </div>

            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Destination & Recipient
              </span>
              <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {delivery.destination.address} ({delivery.destination.city})
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                Contact: {delivery.recipient.name} • {delivery.recipient.phone}
              </p>
            </div>
          </div>
        </div>

        {/* Package Specs */}
        <div
          style={{
            gridColumn: '1 / -1',
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}
        >
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Package size={20} color="var(--color-brand-accent)" />
            Package Information
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Product Name
              </span>
              <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {delivery.productName}
              </p>
            </div>

            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Category & Type
              </span>
              <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', margin: '2px 0 0 0', textTransform: 'capitalize' }}>
                {delivery.package.itemCategory} ({delivery.package.quantity} {delivery.package.packageType})
              </p>
            </div>

            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Weight & Dimensions
              </span>
              <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {delivery.package.weightKg} kg • {delivery.package.dimensionsCm.length}×{delivery.package.dimensionsCm.width}×{delivery.package.dimensionsCm.height} cm
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
