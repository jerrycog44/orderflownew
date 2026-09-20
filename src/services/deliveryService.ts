import type { DeliveryRecord } from '../types';
import { INITIAL_SEED_DELIVERIES } from '../data/mockDeliveries';

const STORAGE_KEY = 'of_dev_deliveries';

export const deliveryService = {
  /**
   * Retrieves all deliveries from localStorage, populating with seed data if empty.
   */
  getAllDeliveries(): DeliveryRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED_DELIVERIES));
        return INITIAL_SEED_DELIVERIES;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_SEED_DELIVERIES;
    }
  },

  /**
   * Retrieves deliveries created by a specific vendor.
   */
  getVendorDeliveries(vendorId: string): DeliveryRecord[] {
    const all = this.getAllDeliveries();
    return all.filter((d) => d.vendorId === vendorId || d.vendorId === 'mock_vendor_1');
  },

  /**
   * Retrieves a single delivery by ID.
   */
  getDeliveryById(id: string): DeliveryRecord | null {
    const all = this.getAllDeliveries();
    return all.find((d) => d.id === id) || null;
  },

  /**
   * Creates a new delivery record and saves to localStorage.
   */
  createDelivery(data: Omit<DeliveryRecord, 'id' | 'createdAt' | 'updatedAt'>): DeliveryRecord {
    const all = this.getAllDeliveries();

    // Generate clean delivery ID e.g. OF-489201
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const id = `OF-${randomNum}`;
    const now = new Date().toISOString();

    const newDelivery: DeliveryRecord = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [newDelivery, ...all];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // storage full or disabled
    }

    return newDelivery;
  },

  /**
   * Retrieves delivery opportunities matching a provider's coverage area or general marketplace pool.
   */
  getProviderOpportunities(coverageArea?: string): DeliveryRecord[] {
    const all = this.getAllDeliveries();
    if (!coverageArea) return all;

    const areaLower = coverageArea.toLowerCase();
    return all.filter(
      (d) =>
        d.status === 'awaiting_pickup' ||
        d.status === 'searching' ||
        d.pickup.city.toLowerCase().includes(areaLower) ||
        d.destination.city.toLowerCase().includes(areaLower)
    );
  },
};
