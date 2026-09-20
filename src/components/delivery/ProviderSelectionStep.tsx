import React, { useState } from 'react';
import { Star, Clock, ShieldCheck, CheckCircle2, ArrowLeft, ArrowRight, Info, AlertTriangle } from 'lucide-react';
import type { LogisticsProvider, PackageDetails, LocationPoint } from '../../types';
import { logisticsService } from '../../services/logisticsService';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ProviderDetailModal } from './ProviderDetailModal';

export interface ProviderSelectionStepProps {
  packageData: PackageDetails;
  pickup: LocationPoint;
  destination: LocationPoint;
  selectedProvider: LogisticsProvider | null;
  onSelectProvider: (provider: LogisticsProvider) => void;
  onBack: () => void;
  onNext: () => void;
}

export const ProviderSelectionStep: React.FC<ProviderSelectionStepProps> = ({
  packageData,
  pickup,
  destination,
  selectedProvider,
  onSelectProvider,
  onBack,
  onNext,
}) => {
  const [detailProvider, setDetailProvider] = useState<LogisticsProvider | null>(null);

  // Run recommendation engine
  const providers = logisticsService.recommendLogisticsProviders({
    package: packageData,
    pickup,
    destination,
  });

  const availableProviders = providers.filter((p) => p.availability === 'available');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Step 4: Choose Logistics Provider
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', maxWidth: '520px', margin: '0 auto' }}>
          Based on your package specs and route, here are verified logistics options that can handle this delivery.
        </p>
      </div>

      {/* No available providers alert if empty */}
      {availableProviders.length === 0 && (
        <div
          style={{
            padding: 'var(--space-6)',
            background: 'var(--color-bg-surface)',
            border: '1px dashed var(--color-warning)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
          }}
        >
          <AlertTriangle size={32} color="var(--color-warning)" style={{ marginBottom: 'var(--space-2)' }} />
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            No immediate available providers for this exact route
          </h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Try modifying your pickup or destination city to view matching partners.
          </p>
        </div>
      )}

      {/* Providers Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 'var(--space-4)' }}>
        {providers.map((provider) => {
          const isSelected = selectedProvider?.id === provider.id;
          const isAvailable = provider.availability === 'available';

          return (
            <div
              key={provider.id}
              style={{
                position: 'relative',
                background: 'var(--color-bg-surface)',
                border: `1.5px solid ${
                  isSelected
                    ? 'var(--color-brand-accent)'
                    : isAvailable
                    ? 'var(--color-border-default)'
                    : 'var(--color-border-subtle)'
                }`,
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-5)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 'var(--space-4)',
                opacity: isAvailable ? 1 : 0.65,
                transition: 'all var(--transition-fast)',
                boxShadow: isSelected ? '0 0 0 1px var(--color-brand-accent), var(--shadow-sm)' : 'none',
              }}
            >
              <div>
                {/* Top Row: Provider Header + Badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <img
                      src={provider.logoUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100'}
                      alt={provider.name}
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-md)',
                        objectFit: 'cover',
                        border: '1px solid var(--color-border-default)',
                      }}
                    />
                    <div>
                      <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>
                        {provider.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        <Star size={12} fill="#F59E0B" color="#F59E0B" />
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{provider.rating}</span>
                        <span>({provider.reviewCount})</span>
                      </div>
                    </div>
                  </div>

                  <Badge variant={isAvailable ? 'success' : provider.availability === 'busy' ? 'warning' : 'neutral'}>
                    {isAvailable ? 'Available now' : provider.availability === 'busy' ? 'Busy' : 'Unavailable'}
                  </Badge>
                </div>

                {/* Recommendation Tag Banner */}
                {provider.recommendationTag && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      color: isAvailable ? 'var(--color-brand-accent)' : 'var(--color-text-tertiary)',
                      backgroundColor: isAvailable ? 'var(--color-brand-accent-light)' : 'var(--color-bg-subtle)',
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      marginBottom: 'var(--space-3)',
                    }}
                  >
                    <ShieldCheck size={13} />
                    <span>{provider.recommendationTag}</span>
                  </div>
                )}

                {/* Pricing & Transit Time Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Est. Price
                    </span>
                    <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-brand-accent)', margin: 0 }}>
                      ₦{provider.estimatedPrice.toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Transit Time
                    </span>
                    <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={14} color="var(--color-text-secondary)" />
                      {provider.estimatedDeliveryTime}
                    </p>
                  </div>
                </div>

                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {provider.recommendationReason}
                </p>
              </div>

              {/* Card Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetailProvider(provider)}
                  leftIcon={<Info size={14} />}
                >
                  View details
                </Button>

                {isAvailable ? (
                  <Button
                    variant={isSelected ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => onSelectProvider(provider)}
                    rightIcon={isSelected ? <CheckCircle2 size={16} /> : undefined}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </Button>
                ) : (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-disabled)', fontWeight: 500 }}>
                    Not selectable
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Provider Details Modal */}
      <ProviderDetailModal
        isOpen={!!detailProvider}
        provider={detailProvider}
        onClose={() => setDetailProvider(null)}
        onSelect={(p) => onSelectProvider(p)}
      />

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
        <Button variant="outline" size="lg" onClick={onBack} leftIcon={<ArrowLeft size={18} />}>
          Back to Review
        </Button>

        <Button
          variant="primary"
          size="lg"
          disabled={!selectedProvider || selectedProvider.availability !== 'available'}
          onClick={onNext}
          rightIcon={<ArrowRight size={18} />}
        >
          {selectedProvider ? `Confirm Logistics (${selectedProvider.name})` : 'Select a logistics provider'}
        </Button>
      </div>
    </div>
  );
};
