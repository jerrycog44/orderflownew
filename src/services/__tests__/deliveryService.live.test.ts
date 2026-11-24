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
  const testRecipientToken =
    'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

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

  it('calls create_delivery_transactional RPC with payment/POD args and maps server secrets', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        delivery_id: testDeliveryId,
        tracking_code: 'OF-3K9X-7M2Q',
        status: 'awaiting_pickup',
        provider_id: testProviderId,
        payment_method: 'cash_on_delivery',
        payment_status: 'pending',
        require_photo_proof: true,
        pod_verification_code: '8429',
        recipient_tracking_token: testRecipientToken,
        current_opportunity_provider_id: null,
        candidate_provider_ids: [testProviderId],
        created_at: '2026-10-19T12:00:00Z',
        updated_at: '2026-10-19T12:00:00Z',
      },
      error: null,
    });

    const result = await deliveryService.createDelivery({
      ...sampleInput,
      requirePhotoProof: true,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'create_delivery_transactional',
      expect.objectContaining({
        p_product_name: 'Solar Battery 200Ah',
        p_dispatch_mode: 'manual',
        p_selected_provider_id: testProviderId,
        p_pickup_city: 'Ikeja',
        p_destination_city: 'Lagos',
        p_payment_method: 'cash_on_delivery',
        p_require_photo_proof: true,
      })
    );

    expect(result.id).toBe(testDeliveryId);
    expect(result.trackingCode).toBe('OF-3K9X-7M2Q');
    expect(result.paymentMethod).toBe('cash_on_delivery');
    expect(result.paymentStatus).toBe('pending');
    expect(result.podVerificationCode).toBe('8429');
    expect(result.recipientTrackingToken).toBe(testRecipientToken);
  });

  it('rejects prepaid_online immediately before invoking live RPC', async () => {
    await expect(
      deliveryService.createDelivery({
        ...sampleInput,
        paymentMethod: 'prepaid_online',
      })
    ).rejects.toThrow(/prepaid payment is unavailable/i);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('throws an error and does not silently fall back to localStorage if transactional RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database RLS policy violated: unauthorized vendor' },
    });

    await expect(deliveryService.createDelivery(sampleInput)).rejects.toThrow(
      'Database RLS policy violated: unauthorized vendor'
    );

    expect(localStorage.getItem('of_dev_deliveries')).toBeNull();
  });

  it('falls back to local storage when create_delivery_transactional RPC is missing from schema cache (PGRST202)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.create_delivery_transactional(...) in the schema cache',
      },
    });

    const result = await deliveryService.createDelivery(sampleInput);
    expect(result).toBeDefined();
    expect(result.id).toMatch(/^OF-\d+/);
    expect(result.productName).toBe(sampleInput.productName);

    const stored = JSON.parse(localStorage.getItem('of_dev_deliveries') || '[]');
    expect(stored.length).toBeGreaterThan(0);
    expect(stored[0].id).toBe(result.id);
  });

  it('getDeliveryById preserves undefined for legacy NULL payment columns and throws on DB error', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection to database terminated' },
          }),
        }),
      }),
    });

    await expect(deliveryService.getDeliveryById(testDeliveryId)).rejects.toThrow(
      'Connection to database terminated'
    );

    // Historical legacy row with NULL payment_method & NULL payment_status
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: testDeliveryId,
              tracking_code: 'OF-HIST-0001',
              vendor_id: testVendorId,
              status: 'delivered',
              dispatch_mode: 'manual',
              pickup_address: '10 Industrial Way',
              pickup_city: 'Ikeja',
              destination_address: '44 Victoria Island Blvd',
              destination_city: 'Lagos',
              recipient_name: 'Chief Obi',
              recipient_phone: '+2348099887766',
              estimated_price: 6500,
              estimated_delivery_time: 'Same Day',
              payment_method: null,
              payment_status: null,
              created_at: '2026-10-01T12:00:00Z',
              updated_at: '2026-10-01T14:00:00Z',
              package_details: [],
              delivery_pod_secrets: null,
              vendors: { business_name: 'Acme Superstore' },
              logistics_providers: null,
            },
            error: null,
          }),
        }),
      }),
    });

    const legacy = await deliveryService.getDeliveryById(testDeliveryId);
    expect(legacy).not.toBeNull();
    expect(legacy?.paymentMethod).toBeUndefined();
    expect(legacy?.paymentStatus).toBeUndefined();
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
  });

  it('updateDeliveryStatus blocks delivered and delegates valid transitions to transition_delivery_status RPC', async () => {
    const blocked = await deliveryService.updateDeliveryStatus(testDeliveryId, 'delivered');
    expect(blocked).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();

    mockRpc.mockResolvedValueOnce({
      data: { success: true, status: 'in_transit' },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: testDeliveryId,
              tracking_code: 'OF-3K9X-7M2Q',
              vendor_id: testVendorId,
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
              payment_method: 'cash_on_delivery',
              payment_status: 'pending',
              created_at: '2026-10-19T12:00:00Z',
              updated_at: '2026-10-19T12:30:00Z',
              package_details: [],
              vendors: { business_name: 'Acme Superstore' },
              logistics_providers: null,
            },
            error: null,
          }),
        }),
      }),
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
    expect(updated?.status).toBe('in_transit');
  });

  it('completeDeliveryWithPod delegates directly to complete_delivery_with_pod RPC (couriers never read delivery_pod_secrets)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: false,
        code: 'invalid_pin',
        attempts_remaining: 4,
        error: 'Invalid 4-digit verification code. Please request the code from the recipient.',
      },
      error: null,
    });

    const zeroAttempt = await deliveryService.completeDeliveryWithPod(testDeliveryId, '0000');
    expect(zeroAttempt.success).toBe(false);
    expect(zeroAttempt.code).toBe('invalid_pin');
    expect(mockRpc).toHaveBeenCalledWith('complete_delivery_with_pod', {
      p_delivery_id: testDeliveryId,
      p_verification_code: '0000',
      p_photo_url: null,
      p_notes: null,
    });
  });

  it('getPublicTracking passes p_recipient_token and maps Case B fields accurately', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          tracking_code: 'OF-3K9X-7M2Q',
          status: 'in_transit',
          estimated_delivery_time: 'Same Day',
          created_at: '2026-10-19T12:00:00Z',
          updated_at: '2026-10-19T12:30:00Z',
          product_name: 'Solar Battery 200Ah',
          vendor_name: 'Acme Superstore',
          provider_name: 'SwiftHaul',
          provider_logo_url: null,
          recipient_access_granted: true,
          payment_method: 'cash_on_delivery',
          payment_status: 'pending',
          amount_due: 6500,
          require_photo_proof: true,
          has_photo_proof: false,
          pod_photo_url: null,
          pod_verification_code: '8429',
        },
      ],
      error: null,
    });

    const info = await deliveryService.getPublicTracking('OF-3K9X-7M2Q', testRecipientToken);
    expect(mockRpc).toHaveBeenCalledWith('get_public_tracking', {
      p_tracking_code: 'OF-3K9X-7M2Q',
      p_recipient_token: testRecipientToken,
    });
    expect(info?.recipientAccessGranted).toBe(true);
    expect(info?.podVerificationCode).toBe('8429');
    expect(info?.amountDue).toBe(6500);
  });
});
