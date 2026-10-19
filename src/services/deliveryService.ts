import type {
  DeliveryRecord,
  DeliveryStatus,
  PackageType,
  PublicTrackingInfo,
} from '../types';
import { INITIAL_SEED_DELIVERIES } from '../data/mockDeliveries';
import { logisticsService } from './logisticsService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STORAGE_KEY = 'of_dev_deliveries';

const isUuid = (val: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

/**
 * Maps database delivery row with joined relationships into domain `DeliveryRecord`.
 */
function mapDatabaseRowToDelivery(row: any): DeliveryRecord {
  const pkg =
    (Array.isArray(row.package_details)
      ? row.package_details[0]
      : row.package_details) || {};
  const provider = row.logistics_providers;
  const vendorName = row.vendors?.business_name || 'Commercial Vendor';

  return {
    id: row.id,
    trackingCode: row.tracking_code,
    vendorId: row.vendor_id,
    vendorName,
    providerId: row.provider_id || undefined,
    selectedProvider: provider
      ? {
          id: provider.id,
          name: provider.provider_name,
          logoUrl: provider.logo_url || undefined,
          availability: 'available',
          serviceAreas: provider.service_areas || [provider.coverage_area],
          estimatedPrice: row.estimated_price,
          currency: 'NGN',
          estimatedDeliveryTime: row.estimated_delivery_time || 'Same Day',
          vehicleTypes: provider.vehicle_types || ['Motorcycle', 'Van'],
          supportedPackageTypes: (provider.package_categories || ['parcel']) as PackageType[],
          rating: provider.rating || 4.8,
          reviewCount: provider.review_count || 120,
          capacity: 'Standard Fleet',
        }
      : undefined,
    productName: pkg.product_name || 'Package Item',
    package: {
      productName: pkg.product_name || 'Package Item',
      itemCategory: pkg.item_category || 'General Goods',
      packageType: (pkg.package_type as PackageType) || 'parcel',
      quantity: pkg.quantity || 1,
      weightKg: pkg.weight_kg || 1,
      dimensionsCm: {
        length: pkg.length_cm || 10,
        width: pkg.width_cm || 10,
        height: pkg.height_cm || 10,
      },
      fragile: pkg.is_fragile ?? false,
      imageUrl: pkg.image_url || undefined,
      notes: pkg.special_instructions || undefined,
    },
    pickup: {
      address: row.pickup_address,
      city: row.pickup_city,
      contactName: row.pickup_contact_name || undefined,
      contactPhone: row.pickup_contact_phone || undefined,
    },
    destination: {
      address: row.destination_address,
      city: row.destination_city,
    },
    recipient: {
      name: row.recipient_name,
      phone: row.recipient_phone,
    },
    deliveryNote: row.delivery_notes || undefined,
    status: row.status as DeliveryStatus,
    dispatchMode: row.dispatch_mode as 'auto' | 'manual',
    estimatedPrice: row.estimated_price,
    estimatedDeliveryTime: row.estimated_delivery_time || 'Same Day',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const deliveryService = {
  /**
   * Retrieves all deliveries from localStorage in offline/demo mode.
   */
  getAllDeliveriesSync(): DeliveryRecord[] {
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
   * Synchronous alias for backward compatibility in mock components.
   */
  getAllDeliveries(): DeliveryRecord[] {
    return this.getAllDeliveriesSync();
  },

  /**
   * Retrieves deliveries created by a specific vendor.
   * When Supabase is configured, queries the `deliveries` table scoped strictly to `vendor_id`.
   * Completely eliminates cross-vendor data leakage.
   */
  async getVendorDeliveries(vendorId: string): Promise<DeliveryRecord[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('deliveries')
          .select(`
            *,
            package_details (*),
            logistics_providers (*),
            vendors (business_name)
          `)
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('deliveryService.getVendorDeliveries error:', error);
          throw new Error(error.message || 'Failed to fetch vendor deliveries');
        }
        return (data || []).map(mapDatabaseRowToDelivery);
      } catch (err) {
        console.error('deliveryService.getVendorDeliveries exception:', err);
        throw err;
      }
    }

    // Offline / Demo fallback: strictly match vendorId (or seed data if vendorId matches seed)
    const all = this.getAllDeliveriesSync();
    return all.filter((d) => d.vendorId === vendorId);
  },

  /**
   * Retrieves a single delivery by ID (supports UUID or alphanumeric tracking code).
   */
  async getDeliveryById(id: string): Promise<DeliveryRecord | null> {
    if (isSupabaseConfigured) {
      try {
        const targetIsUuid = isUuid(id);
        let query = supabase
          .from('deliveries')
          .select(`
            *,
            package_details (*),
            logistics_providers (*),
            vendors (business_name)
          `);

        if (targetIsUuid) {
          query = query.eq('id', id);
        } else {
          query = query.ilike('tracking_code', id.trim());
        }

        const { data, error } = await query.maybeSingle();
        if (error) {
          console.error('deliveryService.getDeliveryById error:', error);
          throw new Error(error.message || 'Failed to fetch delivery');
        }
        return data ? mapDatabaseRowToDelivery(data) : null;
      } catch (err) {
        console.error('deliveryService.getDeliveryById exception:', err);
        throw err;
      }
    }

    // Offline fallback
    const all = this.getAllDeliveriesSync();
    const normalized = id.trim().toLowerCase();
    return (
      all.find(
        (d) =>
          d.id.toLowerCase() === normalized ||
          (d.trackingCode && d.trackingCode.toLowerCase() === normalized)
      ) || null
    );
  },

  /**
   * Creates a new delivery record.
   * In live mode (isSupabaseConfigured = true), invokes the atomic
   * `create_delivery_transactional` database RPC in a single PostgreSQL transaction.
   * If any error occurs, throws an explicit exception rather than masking with mock data.
   * In offline/demo mode, persists to localStorage.
   */
  async createDelivery(
    data: Omit<DeliveryRecord, 'id' | 'createdAt' | 'updatedAt'>,
    idempotencyKey?: string
  ): Promise<DeliveryRecord> {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const trackingCode = `OF-${randomNum}`;
    const now = new Date().toISOString();

    const isAuto = data.dispatchMode === 'auto' || !data.providerId;
    let initialStatus: DeliveryStatus = data.status || (isAuto ? 'opportunity_sent' : 'awaiting_pickup');

    if (isSupabaseConfigured) {
      let candidateIds: string[] = [];
      if (isAuto) {
        try {
          const candidates = await logisticsService.getCandidateQueue({
            package: data.package,
            pickup: data.pickup,
            destination: data.destination,
          });
          candidateIds = candidates.map((c) => c.id).filter(isUuid);
        } catch (candErr) {
          console.warn('Failed to calculate candidate queue:', candErr);
        }
      }

      const { data: res, error: rpcErr } = await supabase.rpc('create_delivery_transactional', {
        p_pickup_address: data.pickup.address,
        p_pickup_city: data.pickup.city,
        p_destination_address: data.destination.address,
        p_destination_city: data.destination.city,
        p_recipient_name: data.recipient.name,
        p_recipient_phone: data.recipient.phone,
        p_estimated_price: data.estimatedPrice,
        p_dispatch_mode: isAuto ? 'auto' : 'manual',
        p_product_name: data.productName,
        p_item_category: data.package.itemCategory,
        p_package_type: data.package.packageType,
        p_weight_kg: data.package.weightKg,
        p_quantity: data.package.quantity,
        p_length_cm: data.package.dimensionsCm?.length ?? null,
        p_width_cm: data.package.dimensionsCm?.width ?? null,
        p_height_cm: data.package.dimensionsCm?.height ?? null,
        p_is_fragile: data.package.fragile,
        p_image_url: data.package.imageUrl || null,
        p_special_instructions: data.package.notes || null,
        p_pickup_contact_name: data.pickup.contactName || null,
        p_pickup_contact_phone: data.pickup.contactPhone || null,
        p_delivery_notes: data.deliveryNote || null,
        p_estimated_delivery_time: data.estimatedDeliveryTime || 'Same Day',
        p_selected_provider_id: !isAuto && data.providerId && isUuid(data.providerId) ? data.providerId : null,
        p_candidate_provider_ids: candidateIds.length > 0 ? candidateIds : null,
        p_idempotency_key: idempotencyKey || null,
      });

      if (rpcErr || !res || !res.success) {
        const errorMsg = rpcErr?.message || (res as { error?: string })?.error || 'Database rejected delivery creation';
        console.error('deliveryService.createDelivery error:', errorMsg);
        throw new Error(errorMsg);
      }

      return {
        ...data,
        id: res.delivery_id,
        trackingCode: res.tracking_code,
        status: res.status as DeliveryStatus,
        providerId: res.provider_id || undefined,
        currentOpportunityProviderId: res.current_opportunity_provider_id || undefined,
        candidateQueue: res.candidate_provider_ids,
        createdAt: res.created_at,
        updatedAt: res.updated_at,
      };
    }

    // Offline / Demo fallback
    let candidateQueue: string[] = [];
    let currentOpportunityProviderId: string | undefined = undefined;

    if (isAuto) {
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
      id: trackingCode,
      trackingCode,
      status: initialStatus,
      candidateQueue: data.candidateQueue || candidateQueue,
      currentOpportunityProviderId: data.currentOpportunityProviderId || currentOpportunityProviderId,
      createdAt: now,
      updatedAt: now,
    };

    const all = this.getAllDeliveriesSync();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newDelivery, ...all]));
    } catch {
      // storage quota
    }

    return newDelivery;
  },

  /**
   * Retrieves open delivery requests available for logistics providers in their coverage area.
   * In live mode, invokes `get_marketplace_opportunities` RPC with PII redaction
   * (hiding customer phone numbers and street addresses until acceptance).
   */
  async getProviderOpportunities(coverageArea?: string): Promise<DeliveryRecord[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('get_marketplace_opportunities', {
          p_coverage_area: coverageArea || null,
        });

        if (error) {
          console.error('deliveryService.getProviderOpportunities error:', error);
          return [];
        }

        if (data) {
          return data.map((row) => ({
            id: row.delivery_id,
            trackingCode: row.tracking_code,
            vendorId: 'vendor_marketplace',
            vendorName: row.vendor_name,
            productName: `${row.quantity}x ${row.item_category}`,
            package: {
              productName: `${row.quantity}x ${row.item_category}`,
              itemCategory: row.item_category,
              packageType: row.package_type,
              quantity: row.quantity,
              weightKg: row.weight_kg,
              dimensionsCm: {
                length: row.length_cm || 10,
                width: row.width_cm || 10,
                height: row.height_cm || 10,
              },
              fragile: row.is_fragile,
            },
            pickup: {
              address: `${row.pickup_city} (Exact address revealed upon acceptance)`,
              city: row.pickup_city,
            },
            destination: {
              address: `${row.destination_city} (Exact address revealed upon acceptance)`,
              city: row.destination_city,
            },
            recipient: {
              name: 'Customer (Protected)',
              phone: 'Hidden until accepted',
            },
            status: row.status as DeliveryStatus,
            dispatchMode: row.dispatch_mode as 'auto' | 'manual',
            estimatedPrice: row.estimated_price,
            estimatedDeliveryTime: row.estimated_delivery_time || 'Same Day',
            createdAt: row.created_at,
            updatedAt: row.created_at,
          }));
        }
        return [];
      } catch (err) {
        console.error('deliveryService.getProviderOpportunities exception:', err);
        return [];
      }
    }

    const all = this.getAllDeliveriesSync();
    return all.filter((d) => {
      const isAvailableStatus =
        d.status === 'created' || d.status === 'searching' || d.status === 'awaiting_pickup';
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
   * Retrieves a targeted dispatch opportunity sent specifically to a provider.
   * Respects real-time provider availability status (suppressed if busy or offline).
   */
  async getProviderTargetedOpportunity(providerId: string): Promise<DeliveryRecord | null> {
    const dynamicAvail = logisticsService.getDynamicAvailability(providerId);
    if (dynamicAvail === 'busy' || dynamicAvail === 'unavailable') {
      return null;
    }

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('get_marketplace_opportunities', {
          p_coverage_area: null,
        });

        if (error) {
          console.error('deliveryService.getProviderTargetedOpportunity error:', error);
          return null;
        }

        if (data) {
          const targeted = data.find((row) => row.is_targeted_offer);
          if (targeted) {
            return {
              id: targeted.delivery_id,
              trackingCode: targeted.tracking_code,
              vendorId: 'vendor_marketplace',
              vendorName: targeted.vendor_name,
              productName: `${targeted.quantity}x ${targeted.item_category}`,
              package: {
                productName: `${targeted.quantity}x ${targeted.item_category}`,
                itemCategory: targeted.item_category,
                packageType: targeted.package_type,
                quantity: targeted.quantity,
                weightKg: targeted.weight_kg,
                dimensionsCm: {
                  length: targeted.length_cm || 10,
                  width: targeted.width_cm || 10,
                  height: targeted.height_cm || 10,
                },
                fragile: targeted.is_fragile,
              },
              pickup: {
                address: `${targeted.pickup_city} (Exact address revealed upon acceptance)`,
                city: targeted.pickup_city,
              },
              destination: {
                address: `${targeted.destination_city} (Exact address revealed upon acceptance)`,
                city: targeted.destination_city,
              },
              recipient: {
                name: 'Customer (Protected)',
                phone: 'Hidden until accepted',
              },
              status: targeted.status as DeliveryStatus,
              dispatchMode: targeted.dispatch_mode as 'auto' | 'manual',
              estimatedPrice: targeted.estimated_price,
              estimatedDeliveryTime: targeted.estimated_delivery_time || 'Same Day',
              createdAt: targeted.created_at,
              updatedAt: targeted.created_at,
            };
          }
        }
        return null;
      } catch (err) {
        console.error('deliveryService.getProviderTargetedOpportunity exception:', err);
        return null;
      }
    }

    const all = this.getAllDeliveriesSync();
    return (
      all.find(
        (d) =>
          d.status === 'opportunity_sent' &&
          (d.currentOpportunityProviderId === providerId ||
            (!d.currentOpportunityProviderId && providerId === 'prov_swifthaul'))
      ) || null
    );
  },

  /**
   * Retrieves deliveries assigned to or accepted by a specific provider.
   */
  async getProviderAssignedDeliveries(providerId: string): Promise<DeliveryRecord[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('deliveries')
          .select(`
            *,
            package_details (*),
            logistics_providers (*),
            vendors (business_name)
          `)
          .eq('provider_id', providerId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('deliveryService.getProviderAssignedDeliveries error:', error);
          return [];
        }
        return (data || []).map(mapDatabaseRowToDelivery);
      } catch (err) {
        console.error('deliveryService.getProviderAssignedDeliveries exception:', err);
        return [];
      }
    }

    const all = this.getAllDeliveriesSync();
    return all.filter((d) => d.providerId === providerId || d.selectedProvider?.id === providerId);
  },

  /**
   * Accepts a delivery opportunity on behalf of a logistics provider.
   * Invokes atomic database RPC `accept_delivery_opportunity` with row locking (`FOR UPDATE`)
   * to eliminate race conditions and double-assignment.
   */
  async acceptDelivery(
    deliveryId: string,
    providerId: string,
    providerName: string
  ): Promise<DeliveryRecord | null> {
    if (isSupabaseConfigured) {
      if (isUuid(deliveryId) && isUuid(providerId)) {
        try {
          const { data: res, error } = await supabase.rpc('accept_delivery_opportunity', {
            p_delivery_id: deliveryId,
            p_provider_id: providerId,
          });

          if (error) {
            console.error('deliveryService.acceptDelivery RPC error:', error);
            return null;
          }

          if (res && res.success) {
            return await this.getDeliveryById(deliveryId);
          }
          if (res && !res.success) {
            console.warn('deliveryService.acceptDelivery rejected by database:', res.error);
          }
          return null;
        } catch (err) {
          console.error('deliveryService.acceptDelivery exception:', err);
          return null;
        }
      }
      return null;
    }

    // Offline / Demo fallback with double-assignment guard
    const all = this.getAllDeliveriesSync();
    const index = all.findIndex((d) => d.id === deliveryId || d.trackingCode === deliveryId);
    if (index === -1) return null;

    const target = all[index];
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
            capacity: 'Standard Fleet',
          },
      updatedAt: new Date().toISOString(),
    };

    all[index] = updatedRecord;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // storage error
    }

    return updatedRecord;
  },

  /**
   * Declines a delivery opportunity and triggers automated queue advancement via RPC.
   */
  async declineOpportunity(deliveryId: string, providerId: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      if (isUuid(deliveryId) && isUuid(providerId)) {
        try {
          const { data: res, error } = await supabase.rpc('decline_delivery_opportunity', {
            p_delivery_id: deliveryId,
            p_provider_id: providerId,
          });

          if (error) {
            console.error('deliveryService.declineOpportunity RPC error:', error);
            return false;
          }

          return Boolean(res?.success);
        } catch (err) {
          console.error('deliveryService.declineOpportunity exception:', err);
          return false;
        }
      }
      return false;
    }

    // Offline / Demo fallback
    const all = this.getAllDeliveriesSync();
    const index = all.findIndex((d) => d.id === deliveryId || d.trackingCode === deliveryId);
    if (index === -1) return false;

    const target = all[index];
    const declined = [...(target.declinedProviderIds || []), providerId];
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

    return true;
  },

  /**
   * Updates delivery status enforcing the state machine.
   * In live mode, delegates to `transition_delivery_status` RPC which validates
   * role authorization and automatically logs a single authoritative audit row.
   */
  async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus,
    _userId?: string,
    notes?: string
  ): Promise<DeliveryRecord | null> {
    if (isSupabaseConfigured) {
      if (isUuid(deliveryId)) {
        try {
          const { data: res, error } = await supabase.rpc('transition_delivery_status', {
            p_delivery_id: deliveryId,
            p_new_status: status,
            p_notes: notes || null,
          });

          if (error) {
            console.error('deliveryService.updateDeliveryStatus error:', error);
            return null;
          }

          if (res && res.success) {
            return await this.getDeliveryById(deliveryId);
          }

          if (res && !res.success) {
            console.warn('deliveryService.updateDeliveryStatus rejected:', res.error);
          }
          return null;
        } catch (err) {
          console.error('deliveryService.updateDeliveryStatus exception:', err);
          return null;
        }
      }
      return null;
    }

    // Offline / Demo fallback
    const all = this.getAllDeliveriesSync();
    const index = all.findIndex((d) => d.id === deliveryId || d.trackingCode === deliveryId);
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
      // storage error
    }

    return updatedRecord;
  },

  /**
   * Secure, privacy-safe public tracking function.
   * Invokes `get_public_tracking` RPC in Supabase, returning only public fields
   * (never exposing recipient phone numbers, street addresses, or private internal rates).
   */
  async getPublicTracking(trackingCode: string): Promise<PublicTrackingInfo | null> {
    const cleanCode = trackingCode.trim();
    if (!cleanCode) return null;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('get_public_tracking', {
          p_tracking_code: cleanCode,
        });

        if (!error && data && data.length > 0) {
          const row = data[0];
          return {
            trackingCode: row.tracking_code,
            status: row.status as DeliveryStatus,
            estimatedDeliveryTime: row.estimated_delivery_time,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            productName: row.product_name,
            vendorName: row.vendor_name,
            providerName: row.provider_name,
            providerLogoUrl: row.provider_logo_url,
          };
        }
      } catch (err) {
        console.warn('deliveryService.getPublicTracking error, using fallback:', err);
      }
    }

    // Offline / Demo fallback: sanitize mock delivery record
    const all = this.getAllDeliveriesSync();
    const target = all.find(
      (d) =>
        d.id.toLowerCase() === cleanCode.toLowerCase() ||
        (d.trackingCode && d.trackingCode.toLowerCase() === cleanCode.toLowerCase())
    );

    if (!target) return null;

    return {
      trackingCode: target.trackingCode || target.id,
      status: target.status,
      estimatedDeliveryTime: target.estimatedDeliveryTime || 'Same Day',
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
      productName: target.productName,
      vendorName: target.vendorName,
      providerName: target.selectedProvider?.name || null,
      providerLogoUrl: target.selectedProvider?.logoUrl || null,
    };
  },

  /**
   * Retrieves full delivery details by tracking code (for authenticated vendor/provider views).
   */
  async getDeliveryByTrackingCode(code: string): Promise<DeliveryRecord | null> {
    return this.getDeliveryById(code);
  },
};
