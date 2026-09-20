import React from 'react';
import { Package, MapPin, Navigation, Edit3, ArrowLeft, Search } from 'lucide-react';
import type { PackageDetails, LocationPoint } from '../../types';
import { Button } from '../ui/Button';

export interface ReviewStepProps {
  packageData: PackageDetails;
  pickup: LocationPoint;
  destination: LocationPoint;
  recipient: { name: string; phone: string };
  deliveryNote?: string;
  onEditPackage: () => void;
  onEditLocations: () => void;
  onBack: () => void;
  onConfirmReview: () => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  packageData,
  pickup,
  destination,
  recipient,
  deliveryNote,
  onEditPackage,
  onEditLocations,
  onBack,
  onConfirmReview,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Step 3: Review Delivery Request
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Verify your shipment details before searching for available logistics providers.
        </p>
      </div>

      {/* Package Summary Card */}
      <div
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Package size={20} color="var(--color-brand-accent)" />
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              Package Specs
            </h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onEditPackage} leftIcon={<Edit3 size={14} />}>
            Edit Package
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
              Product & Category
            </span>
            <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
              {packageData.productName}
            </p>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {packageData.itemCategory}
            </span>
          </div>

          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
              Quantity & Type
            </span>
            <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', margin: '2px 0 0 0', textTransform: 'capitalize' }}>
              {packageData.quantity} {packageData.packageType.replace('_', ' ')}
            </p>
          </div>

          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
              Weight & Dimensions
            </span>
            <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
              {packageData.weightKg} kg • {packageData.dimensionsCm.length}×{packageData.dimensionsCm.width}×{packageData.dimensionsCm.height} cm
            </p>
          </div>

          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
              Fragile Handling
            </span>
            <p style={{ fontWeight: 500, color: packageData.fragile ? '#E11D48' : 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
              {packageData.fragile ? 'Yes (Fragile handling required)' : 'Standard handling'}
            </p>
          </div>
        </div>

        {packageData.notes && (
          <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              Special Notes:
            </span>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
              {packageData.notes}
            </p>
          </div>
        )}
      </div>

      {/* Locations & Recipient Card */}
      <div
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <MapPin size={20} color="var(--color-brand-accent)" />
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              Route & Recipient
            </h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onEditLocations} leftIcon={<Edit3 size={14} />}>
            Edit Locations
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-6)', fontSize: 'var(--font-size-sm)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <MapPin size={20} color="var(--color-brand-accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Pickup Location
              </span>
              <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {pickup.address}
              </p>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {pickup.city}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Navigation size={20} color="#10B981" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Destination & Recipient
              </span>
              <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {destination.address}, {destination.city}
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                Recipient: <strong>{recipient.name}</strong> ({recipient.phone})
              </p>
            </div>
          </div>
        </div>

        {deliveryNote && (
          <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              Delivery Instructions:
            </span>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
              {deliveryNote}
            </p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
        <Button variant="outline" size="lg" onClick={onBack} leftIcon={<ArrowLeft size={18} />}>
          Back to Locations
        </Button>

        <Button variant="primary" size="lg" onClick={onConfirmReview} rightIcon={<Search size={18} />}>
          Find Logistics Providers
        </Button>
      </div>
    </div>
  );
};
