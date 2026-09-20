import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, MapPin, CheckCircle, ArrowLeft } from 'lucide-react';
import type { PackageDetails, LocationPoint, LogisticsProvider, DeliveryRecord } from '../../types';
import { useAuth } from '../../auth/AuthContext';
import { deliveryService } from '../../services/deliveryService';
import { Button } from '../ui/Button';

export interface ConfirmationStepProps {
  packageData: PackageDetails;
  pickup: LocationPoint;
  destination: LocationPoint;
  recipient: { name: string; phone: string };
  deliveryNote?: string;
  selectedProvider: LogisticsProvider;
  onBack: () => void;
}

export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  packageData,
  pickup,
  destination,
  recipient,
  deliveryNote,
  selectedProvider,
  onBack,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdDelivery, setCreatedDelivery] = useState<DeliveryRecord | null>(null);

  const handleConfirmDelivery = () => {
    setIsSubmitting(true);

    try {
      const newDelivery = deliveryService.createDelivery({
        vendorId: user?.id || 'mock_vendor_1',
        vendorName: user?.fullName || 'Vendor',
        providerId: selectedProvider.id,
        selectedProvider,
        productName: packageData.productName,
        package: packageData,
        pickup,
        destination,
        recipient,
        deliveryNote,
        status: 'awaiting_pickup',
        estimatedPrice: selectedProvider.estimatedPrice,
        estimatedDeliveryTime: selectedProvider.estimatedDeliveryTime,
      });

      setCreatedDelivery(newDelivery);
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS STATE VIEW
  if (createdDelivery) {
    return (
      <div
        style={{
          maxWidth: '560px',
          margin: '0 auto',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8) var(--space-6)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(16, 185, 129, 0.12)',
            color: '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-4) auto',
          }}
        >
          <CheckCircle size={36} />
        </div>

        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
          Delivery Request Created
        </h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
          Your delivery request has been created with <strong>{selectedProvider.name}</strong>.
        </p>

        {/* Summary Details Card */}
        <div
          style={{
            background: 'var(--color-bg-subtle)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-5)',
            textAlign: 'left',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Delivery ID
            </span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-brand-accent)', fontSize: 'var(--font-size-base)' }}>
              {createdDelivery.id}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Status
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#10B981', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
              Awaiting Pickup
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Logistics Partner
            </span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {selectedProvider.name}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Estimated Transit
            </span>
            <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {createdDelivery.estimatedDeliveryTime}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Price
            </span>
            <span style={{ fontWeight: 700, color: 'var(--color-brand-accent)' }}>
              ₦{createdDelivery.estimatedPrice.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate(`/vendor/deliveries/${createdDelivery.id}`)}
          >
            View Delivery Details
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/vendor/dashboard')}
          >
            Back to Vendor Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // FINAL CONFIRMATION SUMMARY VIEW
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Step 5: Final Delivery Confirmation
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Please review your final order details before creating the delivery request.
        </p>
      </div>

      <div
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)',
        }}
      >
        {/* Logistics Provider Selection Summary Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-4)',
            background: 'var(--color-brand-accent-light)',
            border: '1px solid var(--color-brand-accent-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <img
              src={selectedProvider.logoUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100'}
              alt={selectedProvider.name}
              style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', objectFit: 'cover' }}
            />
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-accent)', fontWeight: 600, textTransform: 'uppercase' }}>
                Chosen Logistics Partner
              </span>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                {selectedProvider.name}
              </h3>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Price
            </span>
            <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-brand-accent)', margin: 0 }}>
              ₦{selectedProvider.estimatedPrice.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Detailed Summary Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-5)', fontSize: 'var(--font-size-sm)' }}>
          {/* Package Info */}
          <div style={{ padding: 'var(--space-4)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <Package size={16} color="var(--color-brand-accent)" />
              <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', margin: 0 }}>
                Package Specs
              </h4>
            </div>
            <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              {packageData.productName}
            </p>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
              {packageData.quantity} {packageData.packageType} • {packageData.weightKg} kg
            </p>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', margin: '2px 0 0 0' }}>
              {packageData.dimensionsCm.length}×{packageData.dimensionsCm.width}×{packageData.dimensionsCm.height} cm
            </p>
          </div>

          {/* Pickup & Destination */}
          <div style={{ padding: 'var(--space-4)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <MapPin size={16} color="var(--color-brand-accent)" />
              <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', margin: 0 }}>
                Pickup & Destination
              </h4>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
              <strong>From:</strong> {pickup.address}, {pickup.city}
            </p>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
              <strong>To:</strong> {destination.address}, {destination.city}
            </p>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', margin: '4px 0 0 0' }}>
              Recipient: <strong>{recipient.name}</strong> ({recipient.phone})
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
        <Button variant="outline" size="lg" onClick={onBack} leftIcon={<ArrowLeft size={18} />}>
          Back to Logistics
        </Button>

        <Button
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          onClick={handleConfirmDelivery}
          rightIcon={<CheckCircle size={18} />}
        >
          Confirm Delivery
        </Button>
      </div>
    </div>
  );
};
