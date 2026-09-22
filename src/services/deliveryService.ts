import type { DeliveryRecord } from '../types';
import { INITIAL_SEED_DELIVERIES } from '../data/mockDeliveries';
import { logisticsService } from './logisticsService';

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

    let candidateQueue: string[] = [];
    let currentOpportunityProviderId: string | undefined = undefined;
    let initialStatus = data.status || 'created';

    // If auto-dispatch mode, build ranked candidate queue
    if (data.dispatchMode === 'auto' || !data.providerId) {
      const candidates = logisticsService.buildCandidateQueue({
        package: data.package,
        pickup: data.pickup,
        destination: data.destination,
      });

      candidateQueue = candidates.map((c) => c.id);
      if (candidateQueue.length > 0) {
        currentOpportunityProviderId = candidateQueue[0];
        initialStatus = 'opportunity_sent';
      } else {
        initialStatus = 'searching';
      }
    }

    const newDelivery: DeliveryRecord = {
      ...data,
      id,
      status: initialStatus,
      candidateQueue: data.candidateQueue || candidateQueue,
      currentOpportunityProviderId: data.currentOpportunityProviderId || currentOpportunityProviderId,
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
    return all.filter((d) => {
      const isAvailableStatus = d.status === 'created' || d.status === 'searching' || d.status === 'awaiting_pickup';
      if (!isAvailableStatus) return false;
      if (!coverageArea) return true;
      const areaLower = coverageArea.toLowerCase();
      return (
        d.pickup.city.toLowerCase().includes(areaLower) ||
        d.destination.city.toLowerCase().includes(areaLower)
      );
    });
  },

  /**
   * Retrieves deliveries assigned to or accepted by a specific provider.
   */
  getProviderAssignedDeliveries(providerId: string): DeliveryRecord[] {
    const all = this.getAllDeliveries();
    return all.filter((d) => d.providerId === providerId || d.selectedProvider?.id === providerId);
  },

  /**
   * Updates the status of a specific delivery record.
   */
  updateDeliveryStatus(id: string, status: DeliveryRecord['status']): DeliveryRecord | null {
    const all = this.getAllDeliveries();
    const index = all.findIndex((d) => d.id === id);
    if (index === -1) return null;

    const updatedRecord: DeliveryRecord = {
      ...all[index],
      status,
      updatedAt: new Date().toISOString(),
    };

    all[index] = updatedRecord;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // localStorage error
    }

    return updatedRecord;
  },

  /**
   * Accepts a delivery on behalf of a logistics provider.
   * Prevents double-assignment if already accepted by another provider or completed.
   */
  acceptDelivery(id: string, providerId: string, providerName: string): DeliveryRecord | null {
    const all = this.getAllDeliveries();
    const index = all.findIndex((d) => d.id === id);
    if (index === -1) return null;

    const target = all[index];
    // Guard against double assignment or invalid status
    if (
      target.status === 'provider_selected' ||
      target.status === 'awaiting_pickup' ||
      target.status === 'picked_up' ||
      target.status === 'in_transit' ||
      target.status === 'delivered' ||
      target.status === 'cancelled'
    ) {
      return null;
    }

    const updatedRecord: DeliveryRecord = {
      ...target,
      status: 'provider_selected',
      providerId: providerId,
      selectedProvider: target.selectedProvider
        ? { ...target.selectedProvider, id: providerId, name: providerName }
        : {
            id: providerId,
            name: providerName,
            availability: 'available',
            serviceAreas: [target.pickup.city],
            estimatedPrice: target.estimatedPrice,
            currency: 'NGN',
            estimatedDeliveryTime: target.estimatedDeliveryTime || 'Same Day',
            vehicleTypes: ['Motorcycle', 'Van'],
            supportedPackageTypes: [target.package.packageType],
            rating: 4.9,
            reviewCount: 120,
            capacity: 'Standard',
          },
      updatedAt: new Date().toISOString(),
    };

    all[index] = updatedRecord;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // localStorage error
    }

    return updatedRecord;
  },

  /**
   * Retrieves a targeted delivery opportunity specifically assigned to a provider.
   * Respects dynamic provider availability status (suppresses if provider is busy or offline).
   */
  getProviderTargetedOpportunity(providerId: string): DeliveryRecord | null {
    const dynamicAvail = logisticsService.getDynamicAvailability(providerId);
    if (dynamicAvail === 'busy' || dynamicAvail === 'unavailable') {
      return null;
    }

    const all = this.getAllDeliveries();
    return (
      all.find(
        (d) =>
          d.status === 'opportunity_sent' &&
          (d.currentOpportunityProviderId === providerId || (!d.currentOpportunityProviderId && providerId === 'prov_swifthaul'))
      ) || null
    );
  },

  /**
   * Declines a targeted delivery opportunity and advances the candidate queue to the next eligible provider.
   */
  declineOpportunity(id: string, providerId: string): DeliveryRecord | null {
    const all = this.getAllDeliveries();
    const index = all.findIndex((d) => d.id === id);
    if (index === -1) return null;

    const target = all[index];
    const declined = [...(target.declinedProviderIds || []), providerId];

    // Find next candidate from queue that hasn't declined
    const queue = target.candidateQueue || [];
    const nextCandidateId = queue.find((candId) => !declined.includes(candId));

    let updatedRecord: DeliveryRecord;
    if (nextCandidateId) {
      updatedRecord = {
        ...target,
        status: 'opportunity_sent',
        currentOpportunityProviderId: nextCandidateId,
        declinedProviderIds: declined,
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Queue exhausted — set to searching/pending dispatch
      updatedRecord = {
        ...target,
        status: 'searching',
        currentOpportunityProviderId: undefined,
        declinedProviderIds: declined,
        updatedAt: new Date().toISOString(),
      };
    }

    all[index] = updatedRecord;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // storage error
    }

    return updatedRecord;
  },

  /**
   * Finds a delivery record by ID / tracking code (case insensitive).
   */
  getDeliveryByTrackingCode(code: string): DeliveryRecord | null {
    const all = this.getAllDeliveries();
    const normalized = code.trim().toLowerCase();
    return all.find((d) => d.id.toLowerCase() === normalized) || null;
  },
};

