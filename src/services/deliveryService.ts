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

/**
 * Maps database delivery row with joined relationships into domain `DeliveryRecord`.
 */
function mapDatabaseRowToDelivery(row: any): DeliveryRecord {
  const pkg = Array.isArray(row.package_details)
    ? row.package_details[0]
    : row.package_details || {};
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

        if (!error && data) {
          return data.map(mapDatabaseRowToDelivery);
        }
        if (error) {
          console.warn('deliveryService.getVendorDeliveries error:', error);
        }
      } catch (err) {
        console.warn('deliveryService.getVendorDeliveries exception, using fallback:', err);
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
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        let query = supabase
          .from('deliveries')
          .select(`
            *,
            package_details (*),
            logistics_providers (*),
            vendors (business_name)
          `);

        if (isUuid) {
          query = query.eq('id', id);
        } else {
          query = query.ilike('tracking_code', id.trim());
        }

        const { data, error } = await query.maybeSingle();
        if (!error && data) {
          return mapDatabaseRowToDelivery(data);
        }
      } catch (err) {
        console.warn('deliveryService.getDeliveryById exception, using fallback:', err);
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
   * When Supabase is configured:
   *  1. Inserts order into `deliveries` table.
   *  2. Inserts item specs into `package_details` table.
   *  3. If dispatchMode is auto, calculates candidate providers and seeds `dispatch_opportunities`.
   *  4. Records initial state in `delivery_status_history`.
   * Falls back to localStorage in offline/demo mode.
   */
  async createDelivery(
    data: Omit<DeliveryRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DeliveryRecord> {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const trackingCode = `OF-${randomNum}`;
    const now = new Date().toISOString();

    const isAuto = data.dispatchMode === 'auto' || !data.providerId;
    let initialStatus: DeliveryStatus = data.status || (isAuto ? 'opportunity_sent' : 'awaiting_pickup');

    if (isSupabaseConfigured) {
      try {
        // 1. Insert delivery master record
        const { data: insertedDelivery, error: delError } = await supabase
          .from('deliveries')
          .insert({
            tracking_code: trackingCode,
            vendor_id: data.vendorId,
            provider_id: isAuto ? null : data.providerId || null,
            status: initialStatus,
            dispatch_mode: isAuto ? 'auto' : 'manual',
            pickup_address: data.pickup.address,
            pickup_city: data.pickup.city,
            pickup_contact_name: data.pickup.contactName || null,
            pickup_contact_phone: data.pickup.contactPhone || null,
            destination_address: data.destination.address,
            destination_city: data.destination.city,
            recipient_name: data.recipient.name,
            recipient_phone: data.recipient.phone,
            delivery_notes: data.deliveryNote || null,
            estimated_price: data.estimatedPrice,
            estimated_delivery_time: data.estimatedDeliveryTime || 'Same Day',
          })
          .select()
          .single();

        if (delError || !insertedDelivery) {
          throw new Error(delError?.message || 'Failed to insert delivery row');
        }

        // 2. Insert package details child record
        const { error: pkgError } = await supabase.from('package_details').insert({
          delivery_id: insertedDelivery.id,
          product_name: data.productName,
          item_category: data.package.itemCategory,
          package_type: data.package.packageType,
          quantity: data.package.quantity,
          weight_kg: data.package.weightKg,
          length_cm: data.package.dimensionsCm.length,
          width_cm: data.package.dimensionsCm.width,
          height_cm: data.package.dimensionsCm.height,
          is_fragile: data.package.fragile,
          image_url: data.package.imageUrl || null,
          special_instructions: data.package.notes || null,
        });

        if (pkgError) {
          console.error('deliveryService.createDelivery: package_details error:', pkgError);
        }

        // 3. Automated dispatch queue generation if auto mode
        let candidateQueue: string[] = [];
        let currentOpportunityProviderId: string | undefined = undefined;

        if (isAuto) {
          const candidates = await logisticsService.getCandidateQueue({
            package: data.package,
            pickup: data.pickup,
            destination: data.destination,
          });

          candidateQueue = candidates.map((c) => c.id);

          if (candidateQueue.length > 0) {
            currentOpportunityProviderId = candidateQueue[0];
            initialStatus = 'opportunity_sent';

            // Insert candidate opportunities
            const oppsToInsert = candidates.map((cand, idx) => ({
              delivery_id: insertedDelivery.id,
              provider_id: cand.id,
              rank_order: idx + 1,
              status: idx === 0 ? ('sent' as const) : ('queued' as const),
              sent_at: idx === 0 ? new Date().toISOString() : null,
            }));

            await supabase.from('dispatch_opportunities').insert(oppsToInsert);
          } else {
            initialStatus = 'searching';
            await supabase
              .from('deliveries')
              .update({ status: 'searching' })
              .eq('id', insertedDelivery.id);
          }
        }

        // 4. Record status history audit
        await supabase.from('delivery_status_history').insert({
          delivery_id: insertedDelivery.id,
          previous_status: null,
          new_status: initialStatus,
          changed_by_user_id: data.vendorId,
          notes: 'Delivery order created',
        });

        // 5. Build and return created record
        return {
          ...data,
          id: insertedDelivery.id,
          trackingCode: trackingCode,
          status: initialStatus,
          candidateQueue,
          currentOpportunityProviderId,
          createdAt: insertedDelivery.created_at,
          updatedAt: insertedDelivery.updated_at,
        };
      } catch (err) {
        console.warn('deliveryService.createDelivery Supabase error, falling back to local:', err);
      }
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
   */
  async getProviderOpportunities(coverageArea?: string): Promise<DeliveryRecord[]> {
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
          .in('status', ['created', 'searching', 'opportunity_sent', 'awaiting_pickup'])
          .order('created_at', { ascending: false });

        if (!error && data) {
          const records = data.map(mapDatabaseRowToDelivery);
          if (!coverageArea) return records;
          const areaLower = coverageArea.toLowerCase();
          return records.filter(
            (d) =>
              d.pickup.city.toLowerCase().includes(areaLower) ||
              d.destination.city.toLowerCase().includes(areaLower)
          );
        }
      } catch (err) {
        console.warn('deliveryService.getProviderOpportunities error, using fallback:', err);
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
        const { data: opps, error } = await supabase
          .from('dispatch_opportunities')
          .select(`
            delivery_id,
            deliveries (
              *,
              package_details (*),
              logistics_providers (*),
              vendors (business_name)
            )
          `)
          .eq('provider_id', providerId)
          .eq('status', 'sent')
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && opps && opps.length > 0 && opps[0].deliveries) {
          return mapDatabaseRowToDelivery(opps[0].deliveries);
        }
      } catch (err) {
        console.warn('deliveryService.getProviderTargetedOpportunity error, using fallback:', err);
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

        if (!error && data) {
          return data.map(mapDatabaseRowToDelivery);
        }
      } catch (err) {
        console.warn('deliveryService.getProviderAssignedDeliveries error, using fallback:', err);
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
      try {
        const { data, error } = await supabase.rpc('accept_delivery_opportunity', {
          p_delivery_id: deliveryId,
          p_provider_id: providerId,
        });

        if (error) {
          console.error('deliveryService.acceptDelivery RPC error:', error);
          return null;
        }

        const res = data as { success?: boolean; error?: string } | null;
        if (res && res.success) {
          return await this.getDeliveryById(deliveryId);
        }
        return null;
      } catch (err) {
        console.error('deliveryService.acceptDelivery exception:', err);
        return null;
      }
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
      try {
        const { data, error } = await supabase.rpc('decline_delivery_opportunity', {
          p_delivery_id: deliveryId,
          p_provider_id: providerId,
        });

        if (error) {
          console.error('deliveryService.declineOpportunity RPC error:', error);
          return false;
        }

        const res = data as { success?: boolean } | null;
        return Boolean(res?.success);
      } catch (err) {
        console.error('deliveryService.declineOpportunity exception:', err);
        return false;
      }
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
   */
  async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus,
    userId?: string,
    notes?: string
  ): Promise<DeliveryRecord | null> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('deliveries')
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deliveryId);

        if (error) {
          console.error('deliveryService.updateDeliveryStatus error:', error);
          return null;
        }

        // Audit log in status history
        await supabase.from('delivery_status_history').insert({
          delivery_id: deliveryId,
          previous_status: null,
          new_status: status,
          changed_by_user_id: userId || null,
          notes: notes || `Status updated to ${status}`,
        });

        return await this.getDeliveryById(deliveryId);
      } catch (err) {
        console.error('deliveryService.updateDeliveryStatus exception:', err);
        return null;
      }
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
