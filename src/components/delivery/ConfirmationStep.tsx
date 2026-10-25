import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  MapPin,
  CheckCircle,
  ArrowLeft,
  AlertCircle,
  MessageCircle,
  Copy,
  Check,
  CreditCard,
  Banknote,
  Camera,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { PackageDetails, LocationPoint, LogisticsProvider, DeliveryRecord, PaymentMethod } from '../../types';
import { useAuth } from '../../auth/AuthContext';
import { deliveryService } from '../../services/deliveryService';
import { logisticsService } from '../../services/logisticsService';
import { getWhatsAppShareUrl, generateTrackingWhatsAppMessage, getPublicTrackingUrl } from '../../lib/whatsapp';
import { Button } from '../ui/Button';

export interface ConfirmationStepProps {
  packageData: PackageDetails;
  pickup: LocationPoint;
  destination: LocationPoint;
  recipient: { name: string; phone: string };
  deliveryNote?: string;
  selectedProvider?: LogisticsProvider | null;
  dispatchMode?: 'auto' | 'manual';
  onBack: () => void;
}

export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  packageData,
  pickup,
  destination,
  recipient,
  deliveryNote,
  selectedProvider,
  dispatchMode = 'auto',
  onBack,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [requirePhotoProof, setRequirePhotoProof] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdDelivery, setCreatedDelivery] = useState<DeliveryRecord | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Synchronous ref lock to prevent duplicate rapid submissions
  const isSubmittingRef = React.useRef(false);

  // Genuine dynamic price and transit calculation from routing engine
  const dynamicPricing = React.useMemo(() => {
    const evaluated = logisticsService.recommendLogisticsProviders({
      package: packageData,
      pickup,
      destination,
    });
    const eligible = evaluated.find((p) => p.availability === 'available') || evaluated[0];
    return {
      price: selectedProvider ? selectedProvider.estimatedPrice : (eligible?.estimatedPrice || 3500),
      transitTime: selectedProvider ? selectedProvider.estimatedDeliveryTime : (eligible?.estimatedDeliveryTime || 'Same Day Dispatch'),
      candidateProvider: eligible,
    };
  }, [packageData, pickup, destination, selectedProvider]);

  const handleCopyTrackingLink = async () => {
    if (!createdDelivery) return;
    const url = getPublicTrackingUrl(createdDelivery.trackingCode || createdDelivery.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleConfirmDelivery = async () => {
    // Guard against duplicate concurrent or repeated submissions
    if (isSubmittingRef.current || isSubmitting || createdDelivery) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const isAuto = dispatchMode === 'auto' || !selectedProvider;
      const newDelivery = await deliveryService.createDelivery({
        vendorId: user?.id || 'mock_vendor_1',
        vendorName: user?.fullName || 'Vendor',
        providerId: isAuto ? undefined : selectedProvider?.id,
        selectedProvider: isAuto ? undefined : selectedProvider || undefined,
        dispatchMode: isAuto ? 'auto' : 'manual',
        productName: packageData.productName,
        package: packageData,
        pickup,
        destination,
        recipient,
        deliveryNote,
        status: isAuto ? 'opportunity_sent' : 'awaiting_pickup',
        estimatedPrice: dynamicPricing.price,
        estimatedDeliveryTime: dynamicPricing.transitTime,
        paymentMethod,
        paymentStatus: paymentMethod === 'prepaid_online' ? 'collected' : 'pending',
        requirePhotoProof,
      });

      setCreatedDelivery(newDelivery);
    } catch (err) {
      console.error('Failed to create delivery:', err);
      isSubmittingRef.current = false;
      const message = err instanceof Error ? err.message : 'Failed to create delivery request. Please try again.';
      setSubmitError(message);
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
          {createdDelivery.selectedProvider ? (
            <>Your delivery request has been created with <strong>{createdDelivery.selectedProvider.name}</strong>.</>
          ) : (
            <>OrderFlow Smart Dispatch is evaluating and routing your shipment to the best available logistics provider.</>
          )}
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
              {createdDelivery.trackingCode || createdDelivery.id}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Status
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: createdDelivery.dispatchMode === 'auto' ? '#F59E0B' : '#10B981',
                background: createdDelivery.dispatchMode === 'auto' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              {createdDelivery.dispatchMode === 'auto' ? 'Dispatching to Provider' : 'Awaiting Pickup'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Logistics Partner
            </span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {createdDelivery.selectedProvider?.name || 'OrderFlow Smart Dispatch'}
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
              Payment Method
            </span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {createdDelivery.paymentMethod === 'cash_on_delivery'
                ? 'Cash on Delivery (Pay on Handover)'
                : createdDelivery.paymentMethod === 'pay_at_pickup'
                ? 'Pay at Pickup'
                : 'Prepaid Online'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.08)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>
              Handover PIN (POD)
            </span>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#059669', fontSize: 'var(--font-size-lg)', letterSpacing: '3px' }}>
              {createdDelivery.podVerificationCode || '----'}
            </span>
          </div>

          {createdDelivery.requirePhotoProof && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              <span>Handover Requirement</span>
              <span style={{ fontWeight: 600, color: 'var(--color-brand-accent)' }}>Mandatory Photo Upload Required</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Price
            </span>
            <span style={{ fontWeight: 700, color: 'var(--color-brand-accent)' }}>
              ₦{createdDelivery.estimatedPrice.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Customer Sharing Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <a
            href={getWhatsAppShareUrl(
              createdDelivery.recipient.phone,
              generateTrackingWhatsAppMessage({
                recipientName: createdDelivery.recipient.name,
                productName: createdDelivery.productName,
                trackingCode: createdDelivery.trackingCode || createdDelivery.id,
                vendorName: createdDelivery.vendorName,
                estimatedDeliveryTime: createdDelivery.estimatedDeliveryTime,
                podVerificationCode: createdDelivery.podVerificationCode,
              })
            )}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              backgroundColor: '#25D366',
              color: '#FFFFFF',
              padding: '12px var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--font-size-sm)',
              textDecoration: 'none',
              boxShadow: '0 2px 4px rgba(37, 211, 102, 0.2)',
            }}
          >
            <MessageCircle size={18} />
            Share Tracking & PIN on WhatsApp
          </a>

          <Button
            variant="outline"
            size="md"
            onClick={handleCopyTrackingLink}
          >
            {copiedLink ? <Check size={16} style={{ marginRight: '6px', color: '#10B981' }} /> : <Copy size={16} style={{ marginRight: '6px' }} />}
            {copiedLink ? 'Tracking Link Copied!' : 'Copy Public Tracking Link'}
          </Button>
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
          Final Delivery Confirmation & Dispatch
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Please review your delivery details, payment terms, and handover security settings.
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
            {selectedProvider ? (
              <img
                src={selectedProvider.logoUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100'}
                alt={selectedProvider.name}
                style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-brand-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
            )}
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-accent)', fontWeight: 600, textTransform: 'uppercase' }}>
                {selectedProvider ? 'Chosen Logistics Partner' : 'Smart Dispatch Route'}
              </span>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                {selectedProvider?.name || 'OrderFlow Auto-Dispatch'}
              </h3>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Est. Price
            </span>
            <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-brand-accent)', margin: 0 }}>
              ₦{dynamicPricing.price.toLocaleString()}
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

        {/* Section: Payment Method Selection */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <Banknote size={18} color="var(--color-brand-accent)" />
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase' }}>
              Payment Method & Settlement
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            {/* Option 1: Cash on Delivery */}
            <div
              onClick={() => setPaymentMethod('cash_on_delivery')}
              style={{
                cursor: 'pointer',
                border: paymentMethod === 'cash_on_delivery' ? '2px solid var(--color-brand-accent)' : '1px solid var(--color-border-default)',
                background: paymentMethod === 'cash_on_delivery' ? 'var(--color-brand-accent-light)' : 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Banknote size={16} /> Cash on Delivery
                </span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                  DEFAULT
                </span>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Recipient pays the courier upon package handover via cash or direct bank transfer.
              </p>
            </div>

            {/* Option 2: Pay at Pickup */}
            <div
              onClick={() => setPaymentMethod('pay_at_pickup')}
              style={{
                cursor: 'pointer',
                border: paymentMethod === 'pay_at_pickup' ? '2px solid var(--color-brand-accent)' : '1px solid var(--color-border-default)',
                background: paymentMethod === 'pay_at_pickup' ? 'var(--color-brand-accent-light)' : 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={16} /> Pay at Pickup
                </span>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Vendor settles the delivery fee directly with the dispatch courier at pickup.
              </p>
            </div>

            {/* Option 3: Online Gateway (Paystack / Flutterwave / Interswitch) */}
            <div
              onClick={() => setPaymentMethod('prepaid_online')}
              style={{
                cursor: 'pointer',
                border: paymentMethod === 'prepaid_online' ? '2px solid var(--color-brand-accent)' : '1px solid var(--color-border-default)',
                background: paymentMethod === 'prepaid_online' ? 'var(--color-brand-accent-light)' : 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={16} /> Digital Card / Gateway
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-tertiary)', background: 'var(--color-bg-surface)', padding: '2px 6px', borderRadius: '4px' }}>
                  READY
                </span>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Interswitch WebPAY, Paystack & Flutterwave pre-authorization.
              </p>
            </div>
          </div>
        </div>

        {/* Section: Proof of Delivery (POD) Security */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <ShieldCheck size={18} color="#10B981" />
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase' }}>
              Proof of Delivery (POD) Security
            </h3>
          </div>

          <div
            style={{
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
              <CheckCircle2 size={16} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                <strong>4-Digit Recipient Handover PIN:</strong> A unique verification code is automatically generated for this order. The courier must obtain this code from the recipient to mark delivery complete.
              </p>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                cursor: 'pointer',
                marginTop: 'var(--space-1)',
                paddingTop: 'var(--space-2)',
                borderTop: '1px solid rgba(16, 185, 129, 0.15)',
              }}
            >
              <input
                type="checkbox"
                checked={requirePhotoProof}
                onChange={(e) => setRequirePhotoProof(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--color-brand-accent)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Camera size={14} color="var(--color-brand-accent)" />
                Require courier photo upload proof upon package handover
              </span>
            </label>
          </div>
        </div>
      </div>

      {submitError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            color: '#DC2626',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong>Unable to Create Delivery</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {submitError}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleConfirmDelivery}
            disabled={isSubmitting}
          >
            Retry
          </Button>
        </div>
      )}

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
