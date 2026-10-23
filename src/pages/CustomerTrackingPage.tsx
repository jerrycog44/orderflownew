import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Search, Truck, CheckCircle2, Clock, ShieldCheck, ArrowLeft, Copy, Check, Key, Camera, Banknote } from 'lucide-react';
import { deliveryService } from '../services/deliveryService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { PublicTrackingInfo } from '../types';
import './CustomerTrackingPage.css';

const TRACKING_STEPS = [
  { key: 'created', label: 'Order Created', icon: Package },
  { key: 'dispatching', label: 'Dispatching', icon: Clock },
  { key: 'provider_selected', label: 'Provider Matched', icon: ShieldCheck },
  { key: 'in_transit', label: 'In Transit', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

const getStepIndex = (status: string): number => {
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

export const CustomerTrackingPage: React.FC = () => {
  const { trackingCode } = useParams<{ trackingCode?: string }>();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState(trackingCode || '');
  const [trackingInfo, setTrackingInfo] = useState<PublicTrackingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(Boolean(trackingCode));
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadTracking(code: string) {
      setIsLoading(true);
      setSearched(true);
      try {
        const info = await deliveryService.getPublicTracking(code);
        if (isMounted) {
          setTrackingInfo(info);
        }
      } catch (err) {
        console.error('Error fetching public tracking info:', err);
        if (isMounted) {
          setTrackingInfo(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (trackingCode) {
      loadTracking(trackingCode);
    }

    return () => {
      isMounted = false;
    };
  }, [trackingCode]);

  // Realtime subscription for customer package tracking progression
  useEffect(() => {
    if (!trackingCode) return;

    const unsubscribe = deliveryService.subscribeToDelivery(trackingCode, () => {
      deliveryService.getPublicTracking(trackingCode)
        .then((info) => {
          if (info) setTrackingInfo(info);
        })
        .catch((err) => console.warn('Realtime tracking update error:', err));
    });

    return () => {
      unsubscribe();
    };
  }, [trackingCode]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim();
    if (!clean) return;
    navigate(`/track/${clean}`);
  };

  const currentStep = trackingInfo ? getStepIndex(trackingInfo.status) : 0;

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
          <Button variant="primary" type="submit" isLoading={isLoading} leftIcon={<Search size={16} />}>
            Track Order
          </Button>
        </form>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="tracking-card-section" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
          <Clock size={40} color="var(--color-brand-accent)" style={{ marginBottom: 'var(--space-3)', animation: 'spin 2s linear infinite' }} />
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Verifying Tracking Code...
          </h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
            Retrieving live milestone dispatch status from OrderFlow.
          </p>
        </div>
      ) : trackingInfo ? (
        /* Tracking Result View */
        <div className="tracking-card-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border-default)' }}>
            <div>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-brand-accent)' }}>
                TRACKING CODE: {trackingInfo.trackingCode}
              </span>
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: '4px 0 0 0', color: 'var(--color-text-primary)' }}>
                {trackingInfo.productName}
              </h2>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Dispatched by <strong>{trackingInfo.vendorName}</strong>
              </span>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-2)' }}>
              <Badge
                variant={
                  trackingInfo.status === 'delivered'
                    ? 'success'
                    : trackingInfo.status === 'in_transit'
                    ? 'brand'
                    : trackingInfo.status === 'provider_selected' || trackingInfo.status === 'awaiting_pickup'
                    ? 'info'
                    : 'warning'
                }
              >
                {trackingInfo.status === 'opportunity_sent' || trackingInfo.status === 'searching'
                  ? 'Dispatching'
                  : trackingInfo.status.replace(/_/g, ' ').toUpperCase()}
              </Badge>

              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                {copied ? <Check size={14} style={{ marginRight: '4px', color: '#10B981' }} /> : <Copy size={14} style={{ marginRight: '4px' }} />}
                {copied ? 'Link Copied' : 'Share Link'}
              </Button>
            </div>
          </div>

          {/* Visual Step Timeline */}
          <div
            className="tracking-timeline"
            style={{
              ['--timeline-progress' as string]: `${(currentStep / (TRACKING_STEPS.length - 1)) * 100}%`,
            }}
            aria-label="Delivery progress timeline"
          >
            {TRACKING_STEPS.map((step, idx) => {
              const isCompleted = idx < currentStep;
              const isCurrent = idx === currentStep;
              const StepIcon = step.icon;
              return (
                <div
                  key={step.key}
                  className={`tracking-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                >
                  <div className="tracking-step-dot" title={step.label}>
                    {isCompleted ? <CheckCircle2 size={18} /> : <StepIcon size={18} />}
                  </div>
                  <span className="tracking-step-label">{step.label}</span>
                </div>
              );
            })}
          </div>

          {/* Cash on Delivery (COD) Payment Guidance */}
          {trackingInfo.status !== 'delivered' && trackingInfo.paymentMethod === 'cash_on_delivery' && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.28)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                margin: 'var(--space-6) 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Banknote size={20} />
                </div>
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>
                    Payment on Delivery Required
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Have cash or mobile bank transfer ready upon courier arrival. Remittance is confirmed upon handover.
                  </p>
                </div>
              </div>

              {trackingInfo.amountDue !== undefined && (
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Amount Due
                  </span>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: '#B45309' }}>
                    ₦{trackingInfo.amountDue.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Proof of Delivery (POD) Handover Section for Recipient */}
          {trackingInfo.status !== 'delivered' && trackingInfo.podVerificationCode && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                margin: 'var(--space-6) 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Key size={20} />
                </div>
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                    Your Handover Verification PIN
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Share this 4-digit code with the courier only when receiving your package to verify handover.
                  </p>
                </div>
              </div>

              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 800,
                  letterSpacing: '6px',
                  color: '#059669',
                  background: 'var(--color-bg-surface)',
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {trackingInfo.podVerificationCode}
              </div>
            </div>
          )}

          {trackingInfo.status === 'delivered' && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                margin: 'var(--space-6) 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <CheckCircle2 size={20} color="#10B981" />
                <div>
                  <strong style={{ fontSize: 'var(--font-size-sm)', color: '#059669' }}>
                    Delivery Handover Completed & Verified
                  </strong>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    This package has been successfully delivered and confirmed with the 4-digit handover PIN.
                  </p>
                </div>
              </div>

              {trackingInfo.podPhotoUrl && (
                <div style={{ borderTop: '1px solid rgba(16, 185, 129, 0.2)', paddingTop: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px', textTransform: 'uppercase' }}>
                    <Camera size={14} /> Proof of Delivery Photo
                  </span>
                  <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-default)', maxWidth: '320px', maxHeight: '200px' }}>
                    <img
                      src={trackingInfo.podPhotoUrl}
                      alt="Handover proof"
                      style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Details Grid (Sanitized - no recipient phone or private street address) */}
          <div className="tracking-info-grid">
            <div className="tracking-info-box">
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Package size={14} /> PACKAGE INFORMATION
              </span>
              <p style={{ fontWeight: 600, margin: '6px 0 2px 0', fontSize: 'var(--font-size-sm)' }}>
                {trackingInfo.productName}
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Dispatched by {trackingInfo.vendorName}
              </p>
            </div>

            <div className="tracking-info-box">
              <span style={{ fontSize: 'var(--font-size-xs)', color: '#10B981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={14} /> PRIVACY & INTEGRITY
              </span>
              <p style={{ fontWeight: 600, margin: '6px 0 2px 0', fontSize: 'var(--font-size-sm)' }}>
                OrderFlow Verified Shipment
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Milestone updates logged securely on OrderFlow network
              </p>
            </div>

            <div className="tracking-info-box">
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Truck size={14} /> LOGISTICS PARTNER
              </span>
              <p style={{ fontWeight: 600, margin: '6px 0 2px 0', fontSize: 'var(--font-size-sm)' }}>
                {trackingInfo.providerName || 'Assigning Carrier Partner...'}
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Est. Delivery: {trackingInfo.estimatedDeliveryTime || 'Same Day'}
              </p>
            </div>
          </div>
        </div>
      ) : searched ? (
        <div className="tracking-card-section" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
          <Clock size={40} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-3)' }} />
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Tracking Code Not Found
          </h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
            No delivery record was found matching <code>{trackingCode || searchInput}</code>. Please double-check your code.
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
