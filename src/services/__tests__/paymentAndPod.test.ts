import { describe, it, expect, beforeEach } from 'vitest';
import { deliveryService } from '../deliveryService';
import { generateTrackingWhatsAppMessage } from '../../lib/whatsapp';
import type { DeliveryRecord } from '../../types';

describe('Phase 4: Payment Methods & Proof of Delivery (POD)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const baseDeliveryPayload: Omit<DeliveryRecord, 'id' | 'createdAt' | 'updatedAt'> = {
    vendorId: 'test_vendor_99',
    vendorName: 'Lagos Gadgets Ltd',
    productName: 'Noise Cancelling Headphones',
    package: {
      productName: 'Noise Cancelling Headphones',
      itemCategory: 'Electronics & Luxury',
      packageType: 'box',
      quantity: 1,
      weightKg: 1.2,
      dimensionsCm: { length: 20, width: 15, height: 10 },
      fragile: true,
    },
    pickup: {
      address: 'Plot 5 Computer Village, Ikeja',
      city: 'Lagos',
      contactName: 'Tunde Afolayan',
      contactPhone: '+234 802 345 6789',
    },
    destination: {
      address: 'Flat 4B, Admiralty Way, Lekki Phase 1',
      city: 'Lagos',
      contactName: 'Amaka Eze',
      contactPhone: '+234 813 456 7890',
    },
    recipient: {
      name: 'Amaka Eze',
      phone: '+234 813 456 7890',
    },
    status: 'in_transit',
    estimatedPrice: 4200,
    estimatedDeliveryTime: 'Same Day (2–3 hours)',
  };

  it('creates delivery with default Cash on Delivery (COD) and auto-generated 4-digit PIN', async () => {
    const created = await deliveryService.createDelivery({
      ...baseDeliveryPayload,
      paymentMethod: 'cash_on_delivery',
      requirePhotoProof: false,
    });

    expect(created.id).toBeDefined();
    expect(created.paymentMethod).toBe('cash_on_delivery');
    expect(created.paymentStatus).toBe('pending');
    expect(created.podVerificationCode).toBeDefined();
    expect(created.podVerificationCode).toMatch(/^\d{4}$/);
    expect(created.requirePhotoProof).toBe(false);
  });

  it('sets paymentStatus to collected upfront for prepaid_online deliveries', async () => {
    const created = await deliveryService.createDelivery({
      ...baseDeliveryPayload,
      paymentMethod: 'prepaid_online',
    });

    expect(created.paymentMethod).toBe('prepaid_online');
    expect(created.paymentStatus).toBe('collected');
  });

  it('rejects completeDeliveryWithPod if wrong PIN is entered', async () => {
    const created = await deliveryService.createDelivery({
      ...baseDeliveryPayload,
      podVerificationCode: '7721',
    });

    const result = await deliveryService.completeDeliveryWithPod(created.id, '1234');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid 4-digit verification code');

    // Verify delivery status has NOT changed to delivered
    const target = await deliveryService.getDeliveryById(created.id);
    expect(target?.status).not.toBe('delivered');
  });

  it('rejects completeDeliveryWithPod if vendor requires photo proof but none is provided', async () => {
    const created = await deliveryService.createDelivery({
      ...baseDeliveryPayload,
      podVerificationCode: '8832',
      requirePhotoProof: true,
    });

    const result = await deliveryService.completeDeliveryWithPod(created.id, '8832');
    expect(result.success).toBe(false);
    expect(result.error).toContain('photo proof');

    const target = await deliveryService.getDeliveryById(created.id);
    expect(target?.status).not.toBe('delivered');
  });

  it('completes delivery and transitions payment to collected when valid PIN and photo are provided', async () => {
    const created = await deliveryService.createDelivery({
      ...baseDeliveryPayload,
      paymentMethod: 'cash_on_delivery',
      podVerificationCode: '5544',
      requirePhotoProof: true,
    });

    const mockPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
    const result = await deliveryService.completeDeliveryWithPod(created.id, '5544', mockPhoto);

    expect(result.success).toBe(true);
    expect(result.delivery).toBeDefined();
    expect(result.delivery?.status).toBe('delivered');
    expect(result.delivery?.paymentStatus).toBe('collected');
    expect(result.delivery?.podPhotoUrl).toBe(mockPhoto);
    expect(result.delivery?.podCompletedAt).toBeDefined();

    // Verify persisted record in storage
    const stored = await deliveryService.getDeliveryById(created.id);
    expect(stored?.status).toBe('delivered');
    expect(stored?.paymentStatus).toBe('collected');
    expect(stored?.podPhotoUrl).toBe(mockPhoto);
  });

  it('public tracking exposes PIN, photo requirement, and photo proof upon delivery', async () => {
    const created = await deliveryService.createDelivery({
      ...baseDeliveryPayload,
      podVerificationCode: '9182',
      requirePhotoProof: true,
    });

    // Before delivery
    const publicInfoPre = await deliveryService.getPublicTracking(created.id);
    expect(publicInfoPre).not.toBeNull();
    expect(publicInfoPre?.podVerificationCode).toBe('9182');
    expect(publicInfoPre?.requirePhotoProof).toBe(true);
    expect(publicInfoPre?.hasPhotoProof).toBe(false);

    // Complete delivery with photo
    await deliveryService.completeDeliveryWithPod(created.id, '9182', 'https://example.com/pod.jpg');

    // After delivery
    const publicInfoPost = await deliveryService.getPublicTracking(created.id);
    expect(publicInfoPost?.status).toBe('delivered');
    expect(publicInfoPost?.hasPhotoProof).toBe(true);
    expect(publicInfoPost?.podPhotoUrl).toBe('https://example.com/pod.jpg');
  });

  it('includes 4-digit PIN in generated WhatsApp tracking message', () => {
    const message = generateTrackingWhatsAppMessage({
      recipientName: 'Amaka Eze',
      productName: 'Noise Cancelling Headphones',
      trackingCode: 'OF-992211',
      vendorName: 'Lagos Gadgets Ltd',
      estimatedDeliveryTime: 'Same Day',
      podVerificationCode: '4892',
    });

    expect(message.includes('4892')).toBe(true);
    expect(message.includes('Delivery Verification PIN')).toBe(true);
    expect(message.includes('OF-992211')).toBe(true);
  });
});
