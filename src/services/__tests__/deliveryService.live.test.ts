import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DeliveryRecord } from '../../types';

// Mock supabase client and isSupabaseConfigured flag before importing deliveryService
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: (...args: any[]) => mockFrom(...args),
  },
}));

import { deliveryService } from '../deliveryService';

describe('deliveryService (Live Supabase RPC Mode)', () => {
  const testDeliveryId = '11111111-1111-1111-1111-111111111111';
  const testProviderId = '22222222-2222-2222-2222-222222222222';
  const testVendorId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default mockFrom returns empty chain
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
  });

  const sampleInput: Omit<DeliveryRecord, 'id' | 'createdAt' | 'updatedAt'> = {
    vendorId: testVendorId,
    vendorName: 'Acme Superstore',
    productName: 'Solar Battery 200Ah',
    package: {
      productName: 'Solar Battery 200Ah',
      itemCategory: 'Electronics',
      packageType: 'box',
      quantity: 1,
      weightKg: 45,
      dimensionsCm: { length: 50, width: 30, height: 40 },
      fragile: true,
    },
    pickup: {
      address: '10 Industrial Way',
      city: 'Ikeja',
      contactName: 'Warehouse Mgr',
      contactPhone: '+2348011223344',
    },
    destination: {
      address: '44 Victoria Island Blvd',
      city: 'Lagos',
    },
    recipient: {
      name: 'Chief Obi',
      phone: '+2348099887766',
    },
    dispatchMode: 'manual',
    providerId: testProviderId,
    status: 'awaiting_pickup',
    estimatedPrice: 6500,
    estimatedDeliveryTime: 'Same Day',
  };

  it('calls create_delivery_transactional RPC and maps returned record', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        delivery_id: testDeliveryId,
        tracking_code: 'OF-3K9X-7M2Q',
        status: 'awaiting_pickup',
        provider_id: testProviderId,
        current_opportunity_provider_id: null,
        candidate_provider_ids: [testProviderId],
        created_at: '2026-10-19T12:00:00Z',
      },
      error: null,
    });

    const result = await deliveryService.createDelivery(sampleInput);

    expect(mockRpc).toHaveBeenCalledWith(
      'create_delivery_transactional',
      expect.objectContaining({
        p_product_name: 'Solar Battery 200Ah',
        p_dispatch_mode: 'manual',
        p_selected_provider_id: testProviderId,
        p_pickup_city: 'Ikeja',
        p_destination_city: 'Lagos',
      })
    );

    expect(result.id).toBe(testDeliveryId);
    expect(result.trackingCode).toBe('OF-3K9X-7M2Q');
    expect(result.package.weightKg).toBe(45);
  });

  it('throws an error and does not silently fall back to localStorage if transactional RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database RLS policy violated: unauthorized vendor' },
    });

    await expect(deliveryService.createDelivery(sampleInput)).rejects.toThrow(
      'Database RLS policy violated: unauthorized vendor'
    );

    // Verify localStorage was NOT silently written to
    expect(localStorage.getItem('of_dev_deliveries')).toBeNull();
  });

  it('calls get_marketplace_opportunities with PII-safe filtering', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          delivery_id: testDeliveryId,
          tracking_code: 'OF-MARKET-001',
          vendor_name: 'SuperMart',
          item_category: 'Groceries',
          package_type: 'box',
          quantity: 2,
          weight_kg: 5,
          length_cm: 20,
          width_cm: 20,
          height_cm: 20,
          is_fragile: false,
          pickup_city: 'Ikeja',
          destination_city: 'Surulere',
          status: 'searching',
          dispatch_mode: 'auto',
          estimated_price: 2500,
          estimated_delivery_time: '2 hours',
          created_at: '2026-10-19T12:00:00Z',
          is_targeted_offer: false,
        },
      ],
      error: null,
    });

    const opps = await deliveryService.getProviderOpportunities('Ikeja');

    expect(mockRpc).toHaveBeenCalledWith('get_marketplace_opportunities', {
      p_coverage_area: 'Ikeja',
    });

    expect(opps.length).toBe(1);
    expect(opps[0].pickup.address).toContain('Exact address revealed upon acceptance');
    expect(opps[0].recipient.phone).toBe('Hidden until accepted');
    expect(opps[0].pickup.city).toBe('Ikeja');
  });

  it('acceptDelivery delegates to accept_delivery_opportunity RPC and returns null on conflict', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error: 'Offer expired or already assigned' },
      error: null,
    });

    const result = await deliveryService.acceptDelivery(
      testDeliveryId,
      testProviderId,
      'Express Couriers'
    );

    expect(mockRpc).toHaveBeenCalledWith('accept_delivery_opportunity', {
      p_delivery_id: testDeliveryId,
      p_provider_id: testProviderId,
    });

    expect(result).toBeNull();
  });

  it('declineOpportunity delegates to decline_delivery_opportunity RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const declined = await deliveryService.declineOpportunity(testDeliveryId, testProviderId);

    expect(mockRpc).toHaveBeenCalledWith('decline_delivery_opportunity', {
      p_delivery_id: testDeliveryId,
      p_provider_id: testProviderId,
    });

    expect(declined).toBe(true);
  });

  it('updateDeliveryStatus delegates to transition_delivery_status RPC and refreshes record', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, new_status: 'in_transit' },
      error: null,
    });

    // Mock the subsequent getDeliveryById select query
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: testDeliveryId,
            tracking_code: 'OF-3K9X-7M2Q',
            vendor_id: testVendorId,
            product_name: 'Solar Battery 200Ah',
            status: 'in_transit',
            dispatch_mode: 'auto',
            pickup_address: '10 Industrial Way',
            pickup_city: 'Ikeja',
            destination_address: '44 Victoria Island Blvd',
            destination_city: 'Lagos',
            recipient_name: 'Chief Obi',
            recipient_phone: '+2348099887766',
            estimated_price: 6500,
            estimated_delivery_time: 'Same Day',
            created_at: '2026-10-19T12:00:00Z',
            updated_at: '2026-10-19T12:30:00Z',
            package_details: [],
            vendors: { business_name: 'Acme Superstore' },
            logistics_providers: null,
          },
          error: null,
        }),
      }),
    });

    mockFrom.mockReturnValue({
      select: mockSelect,
    });

    const updated = await deliveryService.updateDeliveryStatus(
      testDeliveryId,
      'in_transit',
      testProviderId
    );

    expect(mockRpc).toHaveBeenCalledWith('transition_delivery_status', {
      p_delivery_id: testDeliveryId,
      p_new_status: 'in_transit',
      p_notes: null,
    });

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('in_transit');
  });
});
