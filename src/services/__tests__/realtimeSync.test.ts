import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { realtimeService, playNotificationChime } from '../realtimeService';
import { deliveryService } from '../deliveryService';

describe('Phase 2: Realtime Synchronization Service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribeToProviderDispatches fires on dispatch mutations and unsubscribes cleanly', () => {
    const callback = vi.fn();
    const unsubscribe = realtimeService.subscribeToProviderDispatches('prov_123', callback);

    expect(callback).not.toHaveBeenCalled();

    // Trigger dispatch mutation
    realtimeService.notifyMutation('dispatch', { id: 'del_1', status: 'opportunity_sent' });
    expect(callback).toHaveBeenCalledTimes(1);

    // Trigger delivery mutation (provider also cares about assigned delivery updates)
    realtimeService.notifyMutation('delivery', { id: 'del_1', status: 'in_transit' });
    expect(callback).toHaveBeenCalledTimes(2);

    // Unsubscribe and verify no more events trigger callback
    unsubscribe();
    realtimeService.notifyMutation('dispatch', { id: 'del_2' });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('subscribeToVendorDeliveries fires on delivery updates and unsubscribes cleanly', () => {
    const callback = vi.fn();
    const unsubscribe = realtimeService.subscribeToVendorDeliveries('vendor_123', callback);

    expect(callback).not.toHaveBeenCalled();

    realtimeService.notifyMutation('delivery', { id: 'del_abc', status: 'picked_up' });
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    realtimeService.notifyMutation('delivery', { id: 'del_def' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('subscribeToDelivery responds to delivery updates for single package tracking', () => {
    const callback = vi.fn();
    const unsubscribe = realtimeService.subscribeToDelivery('OF-TEST-123', callback);

    expect(callback).not.toHaveBeenCalled();

    realtimeService.notifyMutation('delivery', { trackingCode: 'OF-TEST-123', status: 'delivered' });
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    realtimeService.notifyMutation('delivery', { trackingCode: 'OF-TEST-123', status: 'delivered' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('handles cross-tab storage events reactively', () => {
    const callback = vi.fn();
    const unsubscribe = realtimeService.subscribeToVendorDeliveries('vendor_1', callback);

    // Simulate cross-tab storage event
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'of_last_mutation',
        newValue: 'delivery_12345',
      })
    );

    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('playNotificationChime runs safely without throwing exceptions in test environment', () => {
    expect(() => playNotificationChime()).not.toThrow();
  });

  it('deliveryService mutations automatically broadcast realtime events', async () => {
    const callback = vi.fn();
    const unsubscribe = deliveryService.subscribeToVendorDeliveries('vendor_mock', callback);

    // Perform status update mutation through deliveryService
    const seed = deliveryService.getAllDeliveriesSync();
    if (seed.length > 0) {
      const targetId = seed[0].id;
      await deliveryService.updateDeliveryStatus(targetId, 'in_transit');
      expect(callback).toHaveBeenCalled();
    }

    unsubscribe();
  });
});
