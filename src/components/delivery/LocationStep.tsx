import React, { useState } from 'react';
import { MapPin, Navigation, User, Phone, ArrowLeft, ArrowRight } from 'lucide-react';
import type { LocationPoint } from '../../types';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';

export interface LocationStepProps {
  initialPickup: LocationPoint;
  initialDestination: LocationPoint;
  initialRecipient: { name: string; phone: string };
  initialDeliveryNote?: string;
  onBack: () => void;
  onNext: (data: {
    pickup: LocationPoint;
    destination: LocationPoint;
    recipient: { name: string; phone: string };
    deliveryNote?: string;
  }) => void;
}

const NIGERIAN_CITIES = [
  'Ibadan',
  'Lagos',
  'Abuja',
  'Port Harcourt',
  'Kano',
  'Abeokuta',
  'Ilorin',
  'Akure',
  'Enugu',
  'Other',
];

export const LocationStep: React.FC<LocationStepProps> = ({
  initialPickup,
  initialDestination,
  initialRecipient,
  initialDeliveryNote = '',
  onBack,
  onNext,
}) => {
  const [pickup, setPickup] = useState<LocationPoint>(initialPickup);
  const [destination, setDestination] = useState<LocationPoint>(initialDestination);
  const [recipient, setRecipient] = useState(initialRecipient);
  const [deliveryNote, setDeliveryNote] = useState(initialDeliveryNote);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!pickup.address.trim()) {
      newErrors.pickupAddress = 'Pickup address is required.';
    }
    if (!pickup.city.trim()) {
      newErrors.pickupCity = 'Pickup city is required.';
    }
    if (!destination.address.trim()) {
      newErrors.destAddress = 'Destination address is required.';
    }
    if (!destination.city.trim()) {
      newErrors.destCity = 'Destination city is required.';
    }
    if (!recipient.name.trim()) {
      newErrors.recipientName = 'Recipient name is required.';
    }
    if (!recipient.phone.trim()) {
      newErrors.recipientPhone = 'Recipient phone number is required.';
    } else if (recipient.phone.trim().length < 10) {
      newErrors.recipientPhone = 'Please enter a valid phone number.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext({
        pickup,
        destination,
        recipient,
        deliveryNote,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Step 2: Pickup & Delivery Locations
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Specify where to collect the package and where it should be delivered.
        </p>
      </div>

      {/* PICKUP SECTION CARD */}
      <div
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-brand-accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-brand-accent)',
            }}
          >
            <MapPin size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              PICKUP LOCATION
            </h3>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Where the logistics provider will pick up the parcel
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
          <Input
            label="Pickup Address *"
            placeholder="e.g. Plot 12 Commercial Avenue, Bodija"
            value={pickup.address}
            onChange={(e) => {
              setPickup((prev) => ({ ...prev, address: e.target.value }));
              if (errors.pickupAddress) setErrors((prev) => ({ ...prev, pickupAddress: '' }));
            }}
            error={errors.pickupAddress}
          />

          <div className="of-form-field">
            <label className="of-form-label">City / State *</label>
            <input
              type="text"
              className="of-input"
              list="nigerian-cities"
              placeholder="e.g. Ibadan"
              value={pickup.city}
              onChange={(e) => {
                setPickup((prev) => ({ ...prev, city: e.target.value }));
                if (errors.pickupCity) setErrors((prev) => ({ ...prev, pickupCity: '' }));
              }}
            />
            {errors.pickupCity && <p className="of-form-error-msg">{errors.pickupCity}</p>}
          </div>
        </div>
      </div>

      {/* DESTINATION & RECIPIENT SECTION CARD */}
      <div
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(16, 185, 129, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10B981',
            }}
          >
            <Navigation size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              DELIVERY DESTINATION
            </h3>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Final drop-off location and recipient details
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
          <Input
            label="Destination Address *"
            placeholder="e.g. No 45 Ring Road, Challenge"
            value={destination.address}
            onChange={(e) => {
              setDestination((prev) => ({ ...prev, address: e.target.value }));
              if (errors.destAddress) setErrors((prev) => ({ ...prev, destAddress: '' }));
            }}
            error={errors.destAddress}
          />

          <div className="of-form-field">
            <label className="of-form-label">Destination City / State *</label>
            <input
              type="text"
              className="of-input"
              list="nigerian-cities"
              placeholder="e.g. Ibadan"
              value={destination.city}
              onChange={(e) => {
                setDestination((prev) => ({ ...prev, city: e.target.value }));
                if (errors.destCity) setErrors((prev) => ({ ...prev, destCity: '' }));
              }}
            />
            {errors.destCity && <p className="of-form-error-msg">{errors.destCity}</p>}
          </div>
        </div>

        <datalist id="nigerian-cities">
          {NIGERIAN_CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-default)', margin: 'var(--space-2) 0' }} />

        {/* Recipient Details */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
          <Input
            label="Recipient Full Name *"
            placeholder="e.g. Chioma Okeke"
            leftIcon={<User size={16} />}
            value={recipient.name}
            onChange={(e) => {
              setRecipient((prev) => ({ ...prev, name: e.target.value }));
              if (errors.recipientName) setErrors((prev) => ({ ...prev, recipientName: '' }));
            }}
            error={errors.recipientName}
          />

          <Input
            label="Recipient Phone Number *"
            placeholder="e.g. 08129876543"
            leftIcon={<Phone size={16} />}
            value={recipient.phone}
            onChange={(e) => {
              setRecipient((prev) => ({ ...prev, phone: e.target.value }));
              if (errors.recipientPhone) setErrors((prev) => ({ ...prev, recipientPhone: '' }));
            }}
            error={errors.recipientPhone}
          />
        </div>

        <Textarea
          label="Delivery Instructions for Rider (Optional)"
          placeholder="e.g. Gate code 4092 or Call when outside security gate."
          value={deliveryNote}
          onChange={(e) => setDeliveryNote(e.target.value)}
          rows={2}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
        <Button variant="outline" size="lg" type="button" onClick={onBack} leftIcon={<ArrowLeft size={18} />}>
          Back to Package
        </Button>

        <Button variant="primary" size="lg" type="submit" rightIcon={<ArrowRight size={18} />}>
          Review Delivery Request
        </Button>
      </div>
    </form>
  );
};
