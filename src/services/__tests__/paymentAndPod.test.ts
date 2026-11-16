import { describe, it, expect, beforeEach } from 'vitest';
import { deliveryService } from '../deliveryService';
import { generateTrackingWhatsAppMessage } from '../../lib/whatsapp';
import type { DeliveryRecord } from '../../types';

describe('Phase 1 Hardened: Payment Integrity, Proof of Delivery (POD) & Public Tracking Disclosure', () => {
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

  it('creates delivery with default Cash on Delivery (COD), pending status, CSPRNG 4-digit PIN (never 0000), and 64-hex recipient token', async () => {
    const created = await deliveryService.createDelivery({
      ...baseDeliveryPayload,
      paymentMethod: 'cash_on_delivery',
      paymentStatus: 'collected', // caller spoofing must be ignored!
      requirePhotoProof: false,
    });

    expect(created.id).toBeDefined();
    expect(created.paymentMethod).toBe('cash_on_delivery');
    expect(created.paymentStatus).toBe('pending');
    expect(created.podVerificationCode).toMatch(/^[1-9][0-9]{3}$/);
    expect(created.recipientTrackingToken).toMatch(/^[0-9a-f]{64}$/);
    expect(created.requirePhotoProof).toBe(false);
  });

  it('rejects prepaid_online deliveries until a verified payment gateway and webhook exist', async () => {
    await expect(
      deliveryService.createDelivery({
        ...baseDeliveryPayload,
        paymentMethod: 'prepaid_online',
      })
    ).rejects.toThrow(/prepaid payment is unavailable/i);
  });

  it('blocks direct status transition to delivered via updateDeliveryStatus', async () => {
    const created = await deliveryService.createDelivery(baseDeliveryPayload);
    const attempt = await deliveryService.updateDeliveryStatus(created.id, 'delivered');
    expect(attempt).toBeNull();

    const stored = await deliveryService.getDeliveryById(created.id);
    expect(stored?.status).toBe('in_transit');
  });

  it('rejects hardcoded 0000 PIN bypass, locks out after 5 wrong PIN attempts, and unlocks on rotateDeliveryPodSecrets', async () => {
    const created = await deliveryService.createDelivery({
      ...baseDeliveryPayload,
      podVerificationCode: '7721',
    });

    // Hardcoded '0000' MUST fail!
    const bypass = await deliveryService.completeDeliveryWithPod(created.id, '0000');
    expect(bypass.success).toBe(false);
    expect(bypass.code).toBe('invalid_pin');
    expect(bypass.attemptsRemaining).toBe(4);

    // 4 more wrong attempts reach the 5-attempt lockout
    for (let i = 2; i <= 5; i += 1) {
      const wrong = await deliveryService.completeDeliveryWithPod(created.id, '1234');
      expect(wrong.success).toBe(false);
      if (i === 5) {
        expect(wrong.code).toBe('too_many_attempts');
        expect(wrong.attemptsRemaining).toBe(0);
      }
    }

    // Even the old valid PIN is blocked once locked out
    const locked = await deliveryService.completeDeliveryWithPod(created.id, '7721');
    expect(locked.success).toBe(false);
    expect(locked.code).toBe('too_many_attempts');

    // Rotate secrets as vendor -> resets lockout and revokes previous token
    const oldToken = created.recipientTrackingToken!;
    const rotated = await deliveryService.rotateDeliveryPodSecrets(created.id);
    expect(rotated.success).toBe(true);
    expect(rotated.podVerificationCode).toMatch(/^[1-9][0-9]{3}$/);
    expect(rotated.recipientTrackingToken).toMatch(/^[0-9a-f]{64}$/);
    expect(rotated.recipientTrackingToken).not.toBe(oldToken);

    // Old token is now invalid (Case C)
    const oldTokenLookup = await deliveryService.getPublicTracking(created.id, oldToken);
    expect(oldTokenLookup?.recipientAccessGranted).toBe(false);
    expect(oldTokenLookup?.podVerificationCode).toBeNull();

    // Complete delivery with the newly rotated PIN
    const done = await deliveryService.completeDeliveryWithPod(
      created.id,
      rotated.podVerificationCode!
    );
    expect(done.success).toBe(true);
    expect(done.delivery?.status).toBe('delivered');
  });

  it('rejects completeDeliveryWithPod if vendor requires photo proof or photo URL is unsafe', async () => {
    const created = await deliveryService.createDelivery({
      ...baseDeliveryPayload,
      podVerificationCode: '8832',
      requirePhotoProof: true,
    });

    const missingPhoto = await deliveryService.completeDeliveryWithPod(created.id, '8832');
    expect(missingPhoto.success).toBe(false);
    expect(missingPhoto.error).toContain('photo proof');

    const badScheme = await deliveryService.completeDeliveryWithPod(
      created.id,
      '8832',
      'javascript:alert(1)'
    );
    expect(badScheme.success).toBe(false);
    expect(badScheme.code).toBe('invalid_photo_url');

    const target = await deliveryService.getDeliveryById(created.id);
    expect(target?.status).not.toBe('delivered');
  });

  it('completes COD delivery with valid PIN + photo and marks paymentStatus collected, while keeping pay_at_pickup pending', async () => {
    const codOrder = await deliveryService.createDelivery({
      ...baseDeliveryPayload,
      paymentMethod: 'cash_on_delivery',
      podVerificationCode: '5544',
      requirePhotoProof: true,
    });

    const validBase64Photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD=';
    const codResult = await deliveryService.completeDeliveryWithPod(
      codOrder.id,
      '5544',
      validBase64Photo
    );

    expect(codResult.success).toBe(true);
    expect(codResult.delivery?.status).toBe('delivered');
    expect(codResult.delivery?.paymentStatus).toBe('collected');
    expect(codResult.delivery?.podPhotoUrl).toBe(validBase64Photo);
    expect(codResult.delivery?.podCompletedAt).toBeDefined();

    const pickupOrder = await deliveryService.createDelivery({
      ...baseDeliveryPayload,
      paymentMethod: 'pay_at_pickup',
      podVerificationCode: '6655',
      requirePhotoProof: false,
    });
    const pickupResult = await deliveryService.completeDeliveryWithPod(pickupOrder.id, '6655');
    expect(pickupResult.success).toBe(true);
    expect(pickupResult.delivery?.paymentStatus).toBe('pending');
  });

  it('enforces Case A / B / C disclosure rules on getPublicTracking', async () => {
    const created = await deliveryService.createDelivery({
      ...baseDeliveryPayload,
      paymentMethod: 'cash_on_delivery',
      podVerificationCode: '9182',
      requirePhotoProof: true,
    });
    const token = created.recipientTrackingToken!;

    // Case A: Tracking-code-only request -> zero PIN, payment, COD amount, or photo disclosure
    const caseA = await deliveryService.getPublicTracking(created.id);
    expect(caseA).not.toBeNull();
    expect(caseA?.recipientAccessGranted).toBe(false);
    expect(caseA?.podVerificationCode).toBeNull();
    expect(caseA?.paymentMethod).toBeNull();
    expect(caseA?.paymentStatus).toBeNull();
    expect(caseA?.amountDue).toBeNull();
    expect(caseA?.requirePhotoProof).toBeNull();
    expect(caseA?.hasPhotoProof).toBeNull();
    expect(caseA?.podPhotoUrl).toBeNull();

    // Case C: Invalid token -> identical to Case A
    const caseC = await deliveryService.getPublicTracking(created.id, 'f'.repeat(64));
    expect(caseC?.recipientAccessGranted).toBe(false);
    expect(caseC?.podVerificationCode).toBeNull();
    expect(caseC?.amountDue).toBeNull();

    // Case B (Before delivery): Valid recipient token -> returns PIN and COD amount due
    const caseBPre = await deliveryService.getPublicTracking(created.id, token);
    expect(caseBPre?.recipientAccessGranted).toBe(true);
    expect(caseBPre?.podVerificationCode).toBe('9182');
    expect(caseBPre?.amountDue).toBe(4200);
    expect(caseBPre?.requirePhotoProof).toBe(true);
    expect(caseBPre?.hasPhotoProof).toBe(false);
    expect(caseBPre?.podPhotoUrl).toBeNull();

    // Complete delivery with photo
    await deliveryService.completeDeliveryWithPod(
      created.id,
      '9182',
      'https://example.com/pod.jpg'
    );

    // Case B (After delivery): PIN is extinguished to null, POD photo is returned
    const caseBPost = await deliveryService.getPublicTracking(created.id, token);
    expect(caseBPost?.status).toBe('delivered');
    expect(caseBPost?.recipientAccessGranted).toBe(true);
    expect(caseBPost?.podVerificationCode).toBeNull();
    expect(caseBPost?.amountDue).toBeNull();
    expect(caseBPost?.hasPhotoProof).toBe(true);
    expect(caseBPost?.podPhotoUrl).toBe('https://example.com/pod.jpg');

    // Case A (After delivery, no token): POD photo is STILL null
    const caseAPost = await deliveryService.getPublicTracking(created.id);
    expect(caseAPost?.status).toBe('delivered');
    expect(caseAPost?.podPhotoUrl).toBeNull();
  });

  it('includes 4-digit PIN in generated WhatsApp tracking message (legacy helper untouched)', () => {
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
