import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
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
  Clock,
  Key,
  RefreshCw,
  X,
} from 'lucide-react';
import type { DeliveryRecord } from '../types';
import { deliveryService } from '../services/deliveryService';
import { getWhatsAppShareUrl, generateTrackingWhatsAppMessage } from '../lib/whatsapp';
import { buildPublicTrackingUrl, buildRecipientTrackingUrl } from '../lib/trackingLinks';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { MobileHeader } from '../components/mobile';
import './VendorDeliveryDetailPage.css';

const TIMELINE_STEPS = [
  { key: 'created', label: 'Order Created', icon: Package },
  { key: 'dispatching', label: 'Dispatching', icon: Clock },
  { key: 'provider_selected', label: 'Provider Matched', icon: ShieldCheck },
  { key: 'in_transit', label: 'In Transit', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

export const VendorDeliveryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<DeliveryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedRecipient, setCopiedRecipient] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [isRotatingPod, setIsRotatingPod] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotateSuccess, setRotateSuccess] = useState<string | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const handleCopyPublicLink = async () => {
    if (!delivery) return;
    const url = buildPublicTrackingUrl(delivery.trackingCode || delivery.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPublic(true);
      setTimeout(() => setCopiedPublic(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyRecipientLink = async () => {
    if (!delivery?.recipientTrackingToken) return;
    try {
      const url = buildRecipientTrackingUrl(
        delivery.trackingCode || delivery.id,
        delivery.recipientTrackingToken
      );
      await navigator.clipboard.writeText(url);
      setCopiedRecipient(true);
      setTimeout(() => setCopiedRecipient(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyPin = async () => {
    if (!delivery?.podVerificationCode) return;
    try {
      await navigator.clipboard.writeText(delivery.podVerificationCode);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleRotatePodSecrets = async () => {
    if (!delivery || isRotatingPod) return;
    setIsRotatingPod(true);
    setRotateError(null);
    setRotateSuccess(null);
    try {
      const res = await deliveryService.rotateDeliveryPodSecrets(delivery.id);
      if (!res.success) {
        setRotateError(res.error || 'Failed to rotate handover PIN.');
      } else {
        setDelivery((prev) =>
          prev
            ? {
                ...prev,
                podVerificationCode: res.podVerificationCode || prev.podVerificationCode,
                recipientTrackingToken: res.recipientTrackingToken || prev.recipientTrackingToken,
                podTokenExpiresAt: res.tokenExpiresAt || prev.podTokenExpiresAt,
                podTokenRevokedAt: null,
                podFailedAttempts: 0,
              }
            : prev
        );
        setNowMs(Date.now());
        setRotateSuccess(
          'New PIN and recipient link generated. Previous recipient links were revoked — share the updated PIN or link with the recipient.'
        );
      }
    } catch (err) {
      setRotateError(err instanceof Error ? err.message : 'Failed to rotate handover PIN.');
    } finally {
      setIsRotatingPod(false);
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
      case 'picked_up':
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
  const isTerminal = delivery.status === 'delivered' || delivery.status === 'cancelled';
  const hasRecordedPayment = Boolean(delivery.paymentMethod && delivery.paymentStatus);
  const isRecipientTokenExpired = Boolean(
    !isTerminal &&
      delivery.podTokenExpiresAt &&
      !Number.isNaN(new Date(delivery.podTokenExpiresAt).getTime()) &&
      new Date(delivery.podTokenExpiresAt).getTime() <= nowMs
  );

  return (
    <div className="of-delivery-detail-page">
      <MobileHeader
        title={delivery.trackingCode || delivery.id}
        subtitle={delivery.productName}
        showBack
        onBack={() => navigate('/vendor/dashboard')}
        workspaceBadge="Vendor"
        rightAction={
          <button
            type="button"
            className="of-m-icon-btn"
            onClick={handleCopyPublicLink}
            title="Copy Public Tracking Link"
            aria-label="Copy Public Tracking Link"
          >
            {copiedPublic ? <Check size={18} color="#16A34A" /> : <Copy size={18} />}
          </button>
        }
      />

      <div className="of-delivery-detail-container">

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
          const StepIcon = step.icon;

          return (
            <React.Fragment key={step.key}>
              <div className={`of-timeline-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                <div className="of-timeline-icon" title={step.label}>
                  {isCompleted ? <CheckCircle2 size={16} /> : <StepIcon size={16} />}
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

      {/* Customer Tracking & Sharing Card */}
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
              Share tracking updates with <strong>{delivery.recipient.name}</strong> ({delivery.recipient.phone})
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
                podVerificationCode: isTerminal ? undefined : delivery.podVerificationCode,
                recipientTrackingToken: isTerminal ? undefined : delivery.recipientTrackingToken,
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

          {!isTerminal && delivery.recipientTrackingToken && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyRecipientLink}
              data-testid="copy-recipient-link-btn"
            >
              {copiedRecipient ? (
                <Check size={14} style={{ marginRight: '6px', color: '#10B981' }} />
              ) : (
                <Key size={14} style={{ marginRight: '6px', color: '#059669' }} />
              )}
              {copiedRecipient ? 'Recipient Link Copied!' : 'Copy Recipient Link (With PIN)'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyPublicLink}
            data-testid="copy-public-link-btn"
          >
            {copiedPublic ? <Check size={14} style={{ marginRight: '6px', color: '#10B981' }} /> : <Copy size={14} style={{ marginRight: '6px' }} />}
            {copiedPublic ? 'Public Link Copied!' : 'Copy Public Status Link'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              window.open(
                buildPublicTrackingUrl(delivery.trackingCode || delivery.id),
                '_blank',
                'noopener,noreferrer'
              )
            }
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
              {hasRecordedPayment ? (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '4px', flexWrap: 'wrap' }}
                  data-testid="vendor-payment-method-badge"
                >
                  <Badge
                    variant={
                      delivery.paymentStatus === 'collected' || delivery.paymentStatus === 'remitted'
                        ? 'success'
                        : 'warning'
                    }
                  >
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
              ) : (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '4px', flexWrap: 'wrap' }}
                  data-testid="legacy-payment-notice"
                >
                  <Badge variant="neutral">Not Recorded (Legacy Order)</Badge>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    • Payment terms were not recorded for this historical order
                  </span>
                </div>
              )}
            </div>

            {/* 4-Digit Handover PIN & Secret Controls */}
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Recipient Verification PIN
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: '4px', flexWrap: 'wrap' }}>
                <span
                  data-testid="vendor-pod-pin-value"
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
                  {isTerminal ? 'USED' : delivery.podVerificationCode || '----'}
                </span>

                {!isTerminal && delivery.podVerificationCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPin}
                    data-testid="copy-pod-pin-btn"
                  >
                    {copiedPin ? <Check size={14} style={{ marginRight: '4px', color: '#10B981' }} /> : <Copy size={14} style={{ marginRight: '4px' }} />}
                    {copiedPin ? 'PIN Copied' : 'Copy PIN'}
                  </Button>
                )}

                {!isTerminal && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRotatePodSecrets}
                    isLoading={isRotatingPod}
                    data-testid="rotate-pod-secrets-btn"
                  >
                    <RefreshCw size={14} style={{ marginRight: '4px' }} />
                    Rotate PIN / Revoke Link
                  </Button>
                )}
              </div>

              {!isTerminal && (delivery.podFailedAttempts ?? 0) >= 5 && (
                <p
                  role="alert"
                  data-testid="pod-lockout-alert"
                  style={{
                    margin: '6px 0 0 0',
                    fontSize: 'var(--font-size-xs)',
                    color: '#DC2626',
                    fontWeight: 600,
                  }}
                >
                  Handover PIN is locked after 5 failed attempts. Click &ldquo;Rotate PIN / Revoke Link&rdquo; and share the new PIN with the recipient.
                </p>
              )}

              {isRecipientTokenExpired && (
                <p
                  role="alert"
                  data-testid="pod-token-expired-alert"
                  style={{
                    margin: '6px 0 0 0',
                    fontSize: 'var(--font-size-xs)',
                    color: '#D97706',
                    fontWeight: 600,
                  }}
                >
                  The recipient tracking link has expired (7-day window). Click &ldquo;Rotate PIN / Revoke Link&rdquo; to issue a fresh PIN and link.
                </p>
              )}

              {rotateSuccess && (
                <p
                  role="status"
                  data-testid="pod-rotate-success-notice"
                  style={{
                    margin: '6px 0 0 0',
                    fontSize: 'var(--font-size-xs)',
                    color: '#059669',
                    fontWeight: 600,
                  }}
                >
                  {rotateSuccess}
                </p>
              )}

              {rotateError && (
                <p
                  role="alert"
                  style={{ margin: '6px 0 0 0', fontSize: 'var(--font-size-xs)', color: '#DC2626' }}
                >
                  {rotateError}
                </p>
              )}

              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '6px 0 0 0' }}>
                Recipient shares this 4-digit PIN with the courier at handover. Rotating generates a new PIN and revokes any previously shared recipient link.
              </p>
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
                      onClick={() => setIsPhotoModalOpen(true)}
                      title="Click to inspect full handover photo"
                      data-testid="vendor-pod-photo-thumbnail"
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
                {delivery.package.weightKg} kg{delivery.package.dimensionsCm ? ` • ${delivery.package.dimensionsCm.length}×${delivery.package.dimensionsCm.width}×${delivery.package.dimensionsCm.height} cm` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Inline Lightbox Modal for Handover Photo (supports both https:// and data:image/* URLs) */}
    {isPhotoModalOpen && delivery.podPhotoUrl && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Proof of delivery photo preview"
        data-testid="pod-photo-lightbox"
        onClick={() => setIsPhotoModalOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-4)',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            maxWidth: '720px',
            width: '100%',
            background: 'var(--color-bg-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
              Handover Photo Proof — {delivery.trackingCode || delivery.id}
            </strong>
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(false)}
              aria-label="Close photo preview"
              style={{
                border: 'none',
                background: 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-full)',
                width: '32px',
                height: '32px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
          <img
            src={delivery.podPhotoUrl}
            alt="Full proof of delivery handover"
            style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
          />
        </div>
      </div>
    )}
  </div>
  );
};
