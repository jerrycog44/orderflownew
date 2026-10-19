import { describe, it, expect, beforeEach } from 'vitest';
import { deliveryService } from '../deliveryService';
import type { DeliveryRecord } from '../../types';

describe('deliveryService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const sampleDeliveryInput: Omit<DeliveryRecord, 'id' | 'createdAt' | 'updatedAt'> = {
    vendorId: 'vendor_test_123',
    vendorName: 'Acme Traders',
    productName: 'Solar Inverter 5kVA',
    package: {
      productName: 'Solar Inverter 5kVA',
      itemCategory: 'Electronics',
      packageType: 'box',
      quantity: 1,
      weightKg: 18,
      dimensionsCm: { length: 45, width: 35, height: 25 },
      fragile: true,
    },
    pickup: {
      address: '14 Commercial Avenue',
      city: 'Ibadan',
      contactName: 'Warehouse Lead',
      contactPhone: '+2348011112222',
    },
    destination: {
      address: '22 Ring Road Extension, Private Villa 4',
      city: 'Ibadan',
    },
    recipient: {
      name: 'Dr. Tunde Adeleke',
      phone: '+2348099998888',
    },
    dispatchMode: 'auto',
    status: 'opportunity_sent',
    estimatedPrice: 4200,
    estimatedDeliveryTime: 'Same Day (2–4 hours)',
  };

  it('creates a new delivery with tracking code and persists to store', async () => {
    const created = await deliveryService.createDelivery(sampleDeliveryInput);

    expect(created).toBeDefined();
    expect(created.id).toMatch(/^OF-\d{6}$/);
    expect(created.vendorId).toBe('vendor_test_123');
    expect(created.productName).toBe('Solar Inverter 5kVA');
    expect(created.status).toBe('opportunity_sent');
    expect(created.candidateQueue).toBeDefined();
    expect(created.createdAt).toBeDefined();

    // Verify lookup by generated ID
    const retrieved = await deliveryService.getDeliveryById(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(created.id);
  });

  it('enforces strict vendor isolation (Vendor A cannot see Vendor B deliveries)', async () => {
    // Create delivery for Vendor 1
    const del1 = await deliveryService.createDelivery({
      ...sampleDeliveryInput,
      vendorId: 'vendor_alpha',
    });

    // Create delivery for Vendor 2
    const del2 = await deliveryService.createDelivery({
      ...sampleDeliveryInput,
      vendorId: 'vendor_beta',
    });

    const alphaDeliveries = await deliveryService.getVendorDeliveries('vendor_alpha');
    const betaDeliveries = await deliveryService.getVendorDeliveries('vendor_beta');

    expect(alphaDeliveries.some((d) => d.id === del1.id)).toBe(true);
    expect(alphaDeliveries.some((d) => d.id === del2.id)).toBe(false);

    expect(betaDeliveries.some((d) => d.id === del2.id)).toBe(true);
    expect(betaDeliveries.some((d) => d.id === del1.id)).toBe(false);
  });

  it('accepts a delivery and prevents duplicate assignment', async () => {
    const created = await deliveryService.createDelivery({
      ...sampleDeliveryInput,
      status: 'opportunity_sent',
    });

    // Provider 1 accepts
    const accepted = await deliveryService.acceptDelivery(
      created.id,
      'prov_speedy',
      'Speedy Logistics'
    );

    expect(accepted).not.toBeNull();
    expect(accepted?.status).toBe('provider_selected');
    expect(accepted?.providerId).toBe('prov_speedy');
    expect(accepted?.selectedProvider?.name).toBe('Speedy Logistics');

    // Provider 2 tries to accept the already-assigned delivery
    const doubleAccept = await deliveryService.acceptDelivery(
      created.id,
      'prov_rival',
      'Rival Couriers'
    );

    // Double-assignment guard must reject
    expect(doubleAccept).toBeNull();
  });

  it('declines an opportunity and advances queue to next candidate', async () => {
    const created = await deliveryService.createDelivery({
      ...sampleDeliveryInput,
      status: 'opportunity_sent',
      candidateQueue: ['cand_1', 'cand_2', 'cand_3'],
      currentOpportunityProviderId: 'cand_1',
    });

    const declined = await deliveryService.declineOpportunity(created.id, 'cand_1');
    expect(declined).toBe(true);

    const updated = await deliveryService.getDeliveryById(created.id);
    expect(updated?.currentOpportunityProviderId).toBe('cand_2');
    expect(updated?.declinedProviderIds).toContain('cand_1');
  });

  it('sanitizes public tracking info to protect customer PII', async () => {
    const created = await deliveryService.createDelivery(sampleDeliveryInput);

    const publicTracking = await deliveryService.getPublicTracking(created.id);
    expect(publicTracking).not.toBeNull();

    // Verify allowed public fields are present
    expect(publicTracking?.trackingCode).toBe(created.id);
    expect(publicTracking?.productName).toBe('Solar Inverter 5kVA');
    expect(publicTracking?.vendorName).toBe('Acme Traders');
    expect(publicTracking?.status).toBe('opportunity_sent');
    expect(publicTracking?.estimatedDeliveryTime).toBe('Same Day (2–4 hours)');

    // Verify sensitive PII is strictly stripped from public tracking object
    const untyped = publicTracking as unknown as Record<string, unknown>;
    expect(untyped.recipient).toBeUndefined();
    expect(untyped.recipientPhone).toBeUndefined();
    expect(untyped.recipient_phone).toBeUndefined();
    expect(untyped.destinationAddress).toBeUndefined();
    expect(untyped.destination_address).toBeUndefined();
    expect(untyped.pickupAddress).toBeUndefined();
    expect(untyped.pickup_address).toBeUndefined();
    expect(untyped.estimatedPrice).toBeUndefined();
  });
});
