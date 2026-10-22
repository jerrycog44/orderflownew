import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  MapPin,
  Truck,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Camera,
} from 'lucide-react';
import type { DeliveryRecord } from '../types';
import { deliveryService } from '../services/deliveryService';
import { getWhatsAppShareUrl, generateTrackingWhatsAppMessage, getPublicTrackingUrl } from '../lib/whatsapp';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import './VendorDeliveryDetailPage.css';

const TIMELINE_STEPS = [
  { key: 'created', label: 'Order Created' },
  { key: 'dispatching', label: 'Dispatching' },
  { key: 'provider_selected', label: 'Provider Matched' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
];

export const VendorDeliveryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<DeliveryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    if (!delivery) return;
    const url = getPublicTrackingUrl(delivery.trackingCode || delivery.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (id) {
      deliveryService
        .getDeliveryById(id)
        .then((record) => {
          if (isMounted) setDelivery(record);
        })
        .catch((err) => {
          console.error('Failed to load delivery by id:', err);
          if (isMounted) {
            setLoadError(err instanceof Error ? err.message : 'Database query error');
          }
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Realtime subscription for delivery status transitions
  useEffect(() => {
    if (!id) return;

    const unsubscribe = deliveryService.subscribeToDelivery(id, () => {
      deliveryService
        .getDeliveryById(id)
        .then((record) => {
          if (record) setDelivery(record);
        })
        .catch((err) => console.warn('Realtime delivery detail update error:', err));
    });

    return () => {
      unsubscribe();
    };
  }, [id]);

  const handleRetry = () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    deliveryService
      .getDeliveryById(id)
      .then((record) => {
        setDelivery(record);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Database query error');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: '800px', margin: 'var(--space-12) auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading delivery details...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: '600px', margin: 'var(--space-12) auto', textAlign: 'center' }}>
        <AlertCircle size={48} color="#DC2626" style={{ marginBottom: 'var(--space-3)' }} />
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Failed to Load Delivery
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
          {loadError}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)' }}>
          <Button variant="outline" onClick={handleRetry}>
            Retry
          </Button>
          <Button variant="primary" onClick={() => navigate('/vendor/dashboard')}>
            Back to Vendor Dashboard
          </Button>
        </div>
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
      case 'searching':
      case 'opportunity_sent':
        return 1;
      case 'provider_selected':
      case 'awaiting_pickup':
        return 2;
      case 'in_transit':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 1;
    }
  };

  const currentStepIdx = getStepStatusIndex(delivery.status);

  return (
    <div className="of-delivery-detail-container">
      <button
        type="button"
        onClick={() => navigate('/vendor/dashboard')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 600,
          marginBottom: 'var(--space-4)',
          padding: '0',
          transition: 'color var(--transition-fast)',
        }}
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      {/* Header Info */}
      <div className="of-delivery-detail-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-1)', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-text-primary)', margin: 0 }}>
              {delivery.trackingCode || delivery.id}
            </h1>
            <Badge
              variant={
                delivery.status === 'delivered'
                  ? 'success'
                  : delivery.status === 'in_transit'
                  ? 'brand'
                  : delivery.status === 'provider_selected' || delivery.status === 'awaiting_pickup'
                  ? 'info'
                  : 'warning'
              }
            >
              {delivery.status === 'opportunity_sent' || delivery.status === 'searching'
                ? 'Dispatching'
                : delivery.status.replace(/_/g, ' ').toUpperCase()}
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

      {/* Customer Tracking & WhatsApp Sharing Card */}
      <div
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4) var(--space-5)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(37, 211, 102, 0.12)',
              color: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MessageCircle size={22} />
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>
              Customer Live Tracking
            </span>
            <p style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
              Share direct WhatsApp updates and tracking link with <strong>{delivery.recipient.name}</strong> ({delivery.recipient.phone})
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <a
            href={getWhatsAppShareUrl(
              delivery.recipient.phone,
              generateTrackingWhatsAppMessage({
                recipientName: delivery.recipient.name,
                productName: delivery.productName,
                trackingCode: delivery.trackingCode || delivery.id,
                vendorName: delivery.vendorName,
                estimatedDeliveryTime: delivery.estimatedDeliveryTime,
                podVerificationCode: delivery.podVerificationCode,
              })
            )}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              backgroundColor: '#25D366',
              color: '#FFFFFF',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--font-size-sm)',
              textDecoration: 'none',
              boxShadow: '0 2px 4px rgba(37, 211, 102, 0.2)',
            }}
          >
            <MessageCircle size={16} />
            Share on WhatsApp
          </a>

          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? <Check size={14} style={{ marginRight: '6px', color: '#10B981' }} /> : <Copy size={14} style={{ marginRight: '6px' }} />}
            {copied ? 'Link Copied!' : 'Copy Link'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(getPublicTrackingUrl(delivery.trackingCode || delivery.id), '_blank')}
          >
            <ExternalLink size={14} style={{ marginRight: '6px' }} />
            Preview
          </Button>
        </div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-warning)' }}>
                <h4 style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', fontWeight: 700, margin: '0 0 var(--space-1) 0', textTransform: 'uppercase' }}>
                  {delivery.status === 'opportunity_sent' ? 'Smart Dispatch Active' : 'Provider Matching in Progress'}
                </h4>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  {delivery.status === 'opportunity_sent'
                    ? 'OrderFlow has sent a targeted delivery opportunity to the top-ranked candidate provider. Waiting for provider confirmation.'
                    : 'OrderFlow is actively scanning eligible logistics partners covering your pickup and destination area.'}
                </p>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Estimated Fare Range
                </span>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-brand-accent)' }}>
                  ₦{delivery.estimatedPrice.toLocaleString()}
                </span>
              </div>
            </div>
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

        {/* Payment & Proof of Delivery (POD) Security Card */}
        <div
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}
        >
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ShieldCheck size={20} color="#10B981" />
            Payment & Handover Security
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
            {/* Payment Method & Status */}
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Payment Method & Status
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '4px', flexWrap: 'wrap' }}>
                <Badge variant={delivery.paymentStatus === 'collected' ? 'success' : 'warning'}>
                  {delivery.paymentMethod === 'cash_on_delivery'
                    ? 'Cash on Delivery'
                    : delivery.paymentMethod === 'pay_at_pickup'
                    ? 'Pay at Pickup'
                    : 'Prepaid Online'}
                </Badge>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  {delivery.paymentStatus === 'collected'
                    ? '• Fare Collected'
                    : delivery.paymentStatus === 'remitted'
                    ? '• Remitted to Vendor'
                    : '• Pending Collection on Handover'}
                </span>
              </div>
            </div>

            {/* 4-Digit Handover PIN */}
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Recipient Verification PIN
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: '4px' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 'var(--font-size-xl)',
                    fontWeight: 800,
                    letterSpacing: '4px',
                    color: '#059669',
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}
                >
                  {delivery.podVerificationCode || '----'}
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Recipient shares this with the courier to complete delivery.
                </span>
              </div>
            </div>

            {/* Photo Proof Requirement / Proof Image */}
            <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Camera size={14} /> Photo Proof Requirement
              </span>
              <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {delivery.requirePhotoProof ? 'Mandatory courier photo upload enabled' : 'Standard PIN handover verification'}
              </p>

              {delivery.podPhotoUrl && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                    <CheckCircle2 size={14} /> Verified Handover Photo Proof
                  </span>
                  <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-default)', maxHeight: '160px' }}>
                    <img
                      src={delivery.podPhotoUrl}
                      alt="Proof of delivery handover"
                      style={{ width: '100%', height: '160px', objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => window.open(delivery.podPhotoUrl, '_blank')}
                      title="Click to view full photo"
                    />
                  </div>
                  {delivery.podCompletedAt && (
                    <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '4px', display: 'block' }}>
                      Completed at {new Date(delivery.podCompletedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
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
