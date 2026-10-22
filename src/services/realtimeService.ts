/**
 * OrderFlow Realtime Service
 *
 * Provides real-time synchronization via Supabase Realtime WebSockets in live mode,
 * with graceful fallback to cross-tab storage & custom DOM events in offline/dev mode.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// DOM Custom Event Names for local dev & cross-tab sync
export const REALTIME_EVENTS = {
  DELIVERY_UPDATED: 'of:delivery_updated',
  DISPATCH_UPDATED: 'of:dispatch_updated',
};

/**
 * Plays a pleasant synthetic notification chime using the Web Audio API.
 * Does not require external audio files or network requests.
 * Safely ignores errors if audio autoplay is restricted by the browser.
 */
export function playNotificationChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Tone 1 (523.25 Hz - C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Tone 2 (659.25 Hz - E5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.12);
    gain2.gain.setValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.4);
  } catch {
    // Autoplay restrictions or audio disabled; ignore silently
  }
}

export const realtimeService = {
  /**
   * Dispatches a local mutation event to notify other components and tabs in offline/dev mode.
   */
  notifyMutation(eventType: 'delivery' | 'dispatch', payload?: unknown): void {
    const eventName = eventType === 'delivery' ? REALTIME_EVENTS.DELIVERY_UPDATED : REALTIME_EVENTS.DISPATCH_UPDATED;
    try {
      window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
      // Trigger cross-window storage event
      localStorage.setItem('of_last_mutation', `${eventType}_${Date.now()}`);
    } catch {
      // Ignore in environments where window/localStorage is unavailable
    }
  },

  /**
   * Subscribes a Logistics Provider to realtime dispatch opportunities and assigned deliveries.
   * In Supabase mode, listens to `dispatch_opportunities` and `deliveries` tables via WebSocket.
   * In offline mode, listens to custom DOM events and cross-tab storage events.
   *
   * @returns Cleanup/unsubscribe function.
   */
  subscribeToProviderDispatches(
    providerId: string,
    onUpdate: (payload?: unknown) => void
  ): () => void {
    let supabaseChannel: RealtimeChannel | null = null;

    if (isSupabaseConfigured) {
      try {
        const channelName = `provider-realtime-${providerId}-${Date.now()}`;
        supabaseChannel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'dispatch_opportunities',
              filter: `provider_id=eq.${providerId}`,
            },
            (payload) => {
              playNotificationChime();
              onUpdate(payload);
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'deliveries',
              filter: `provider_id=eq.${providerId}`,
            },
            (payload) => {
              onUpdate(payload);
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('realtimeService.subscribeToProviderDispatches error:', err);
      }
    }

    // Always listen to local events as fallback or during local dev
    const handleLocalEvent = (e: Event) => {
      const customEvt = e as CustomEvent;
      onUpdate(customEvt.detail);
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'of_last_mutation' || e.key === 'of_dev_deliveries') {
        onUpdate();
      }
    };

    window.addEventListener(REALTIME_EVENTS.DISPATCH_UPDATED, handleLocalEvent);
    window.addEventListener(REALTIME_EVENTS.DELIVERY_UPDATED, handleLocalEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      if (supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
      window.removeEventListener(REALTIME_EVENTS.DISPATCH_UPDATED, handleLocalEvent);
      window.removeEventListener(REALTIME_EVENTS.DELIVERY_UPDATED, handleLocalEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  },

  /**
   * Subscribes a Vendor to realtime delivery updates (status changes, courier matching).
   *
   * @returns Cleanup/unsubscribe function.
   */
  subscribeToVendorDeliveries(
    vendorId: string,
    onUpdate: (payload?: unknown) => void
  ): () => void {
    let supabaseChannel: RealtimeChannel | null = null;

    if (isSupabaseConfigured) {
      try {
        const channelName = `vendor-realtime-${vendorId}-${Date.now()}`;
        supabaseChannel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'deliveries',
              filter: `vendor_id=eq.${vendorId}`,
            },
            (payload) => {
              onUpdate(payload);
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('realtimeService.subscribeToVendorDeliveries error:', err);
      }
    }

    const handleLocalEvent = (e: Event) => {
      const customEvt = e as CustomEvent;
      onUpdate(customEvt.detail);
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'of_last_mutation' || e.key === 'of_dev_deliveries') {
        onUpdate();
      }
    };

    window.addEventListener(REALTIME_EVENTS.DELIVERY_UPDATED, handleLocalEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      if (supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
      window.removeEventListener(REALTIME_EVENTS.DELIVERY_UPDATED, handleLocalEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  },

  /**
   * Subscribes to realtime updates for a single delivery (by ID or tracking code).
   * Used on Vendor Delivery Detail and Customer Tracking pages.
   *
   * @returns Cleanup/unsubscribe function.
   */
  subscribeToDelivery(
    deliveryId: string,
    onUpdate: (payload?: unknown) => void
  ): () => void {
    let supabaseChannel: RealtimeChannel | null = null;

    if (isSupabaseConfigured) {
      try {
        const channelName = `delivery-detail-${deliveryId}-${Date.now()}`;
        supabaseChannel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'deliveries',
              filter: `id=eq.${deliveryId}`,
            },
            (payload) => {
              onUpdate(payload);
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('realtimeService.subscribeToDelivery error:', err);
      }
    }

    const handleLocalEvent = (e: Event) => {
      const customEvt = e as CustomEvent;
      onUpdate(customEvt.detail);
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'of_last_mutation' || e.key === 'of_dev_deliveries') {
        onUpdate();
      }
    };

    window.addEventListener(REALTIME_EVENTS.DELIVERY_UPDATED, handleLocalEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      if (supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
      window.removeEventListener(REALTIME_EVENTS.DELIVERY_UPDATED, handleLocalEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  },
};
