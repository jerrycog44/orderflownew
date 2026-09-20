import React from 'react';
import { Star, Check, ShieldCheck, Clock } from 'lucide-react';
import type { LogisticsProvider } from '../../types';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface ProviderDetailModalProps {
  isOpen: boolean;
  provider: LogisticsProvider | null;
  onClose: () => void;
  onSelect: (provider: LogisticsProvider) => void;
}

export const ProviderDetailModal: React.FC<ProviderDetailModalProps> = ({
  isOpen,
  provider,
  onClose,
  onSelect,
}) => {
  if (!provider) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={provider.name} maxWidth="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/* Header Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <img
            src={provider.logoUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100'}
            alt={provider.name}
            style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-md)', objectFit: 'cover', border: '1px solid var(--color-border-default)' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                {provider.name}
              </h3>
              <Badge variant={provider.availability === 'available' ? 'success' : provider.availability === 'busy' ? 'warning' : 'neutral'}>
                {provider.availability === 'available' ? 'Available Now' : provider.availability === 'busy' ? 'Busy' : 'Unavailable'}
              </Badge>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                <Star size={14} fill="#F59E0B" color="#F59E0B" />
                {provider.rating} ({provider.reviewCount} reviews)
              </span>
              <span>•</span>
              <span>Capacity: {provider.capacity}</span>
            </div>
          </div>
        </div>

        {provider.recommendationReason && (
          <div
            style={{
              padding: 'var(--space-3)',
              background: 'var(--color-brand-accent-light)',
              border: '1px solid var(--color-brand-accent-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-brand-accent)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-2)',
            }}
          >
            <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{provider.recommendationReason}</span>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
          <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Est. Transit Time
            </span>
            <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} color="var(--color-brand-accent)" />
              {provider.estimatedDeliveryTime}
            </p>
          </div>

          <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Estimated Price
            </span>
            <p style={{ fontWeight: 700, color: 'var(--color-brand-accent)', margin: '2px 0 0 0', fontSize: 'var(--font-size-md)' }}>
              ₦{provider.estimatedPrice.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Fleet & Coverage */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Fleet & Vehicles
            </span>
            <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
              {provider.vehicleTypes.join(', ')}
            </p>
          </div>

          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Service Coverage Cities
            </span>
            <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
              {provider.serviceAreas.join(', ')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {provider.availability === 'available' && (
            <Button
              variant="primary"
              onClick={() => {
                onSelect(provider);
                onClose();
              }}
              rightIcon={<Check size={16} />}
            >
              Select Provider
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
