import type {
  DeliveryRecord,
  DeliveryStatus,
  PackageType,
  PaymentMethod,
  PaymentStatus,
  PublicTrackingInfo,
} from '../types';
import { INITIAL_SEED_DELIVERIES } from '../data/mockDeliveries';
import { logisticsService } from './logisticsService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { realtimeService } from './realtimeService';
import { RECIPIENT_TOKEN_REGEX } from '../lib/trackingLinks';

const STORAGE_KEY = 'of_dev_deliveries';
const POD_PIN_REGEX = /^[1-9][0-9]{3}$/;
const POD_PHOTO_URL_REGEX =
  /^(https:\/\/\S+|data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+)$/;
const MAX_POD_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_POD_FAILED_ATTEMPTS = 5;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const isUuid = (val: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

/**
 * Generates a uniform 4-digit PIN in [1000..9999] (never '0000') via CSPRNG
 * rejection sampling for offline/demo mode.
 */
function generateSecurePodPin(): string {
  const buf = new Uint16Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    const candidate = buf[0] & 0x3fff; // 0..16383
    if (candidate < 9000) {
      return String(1000 + candidate);
    }
  }
}

/**
 * Generates a 256-bit (64 lowercase hex characters) recipient capability token
 * via CSPRNG for offline/demo mode.
 */
function generateSecureRecipientToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time string comparison for fixed-format offline secrets.
 */
function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Maps database delivery row with joined relationships into domain `DeliveryRecord`.
 * Preserves `undefined` for nullable historical `payment_method` / `payment_status`
 * so legacy pre-005 orders are never misclassified as COD or Prepaid Online.
 */
function mapDatabaseRowToDelivery(row: any): DeliveryRecord {
  const pkg =
    (Array.isArray(row.package_details)
      ? row.package_details[0]
      : row.package_details) || {};
  const secret = Array.isArray(row.delivery_pod_secrets)
    ? row.delivery_pod_secrets[0]
    : row.delivery_pod_secrets;
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
          rating: provider.rating ?? 5.0,
          reviewCount: provider.review_count ?? 0,
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
    paymentMethod: (row.payment_method as PaymentMethod | null) ?? undefined,
    paymentStatus: (row.payment_status as PaymentStatus | null) ?? undefined,
    podVerificationCode: secret?.pin_code || row.pod_verification_code || undefined,
    recipientTrackingToken: secret?.recipient_token ?? undefined,
    podTokenExpiresAt: secret?.token_expires_at ?? undefined,
    podTokenRevokedAt: secret?.token_revoked_at ?? undefined,
    podFailedAttempts:
      typeof row.pod_failed_attempts === 'number' ? row.pod_failed_attempts : 0,
    requirePhotoProof: Boolean(row.require_photo_proof),
    podPhotoUrl: row.pod_photo_url || undefined,
    podCompletedAt: row.pod_completed_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeOfflineDeliveries(records: DeliveryRecord[]): {
  records: DeliveryRecord[];
  mutated: boolean;
} {
  let mutated = false;
  const normalized = records.map((item) => {
    const isTerminal = item.status === 'delivered' || item.status === 'cancelled';
    if (isTerminal) {
      return item;
    }

    let next = item;
    if (!next.podVerificationCode || !POD_PIN_REGEX.test(next.podVerificationCode)) {
      next = { ...next, podVerificationCode: generateSecurePodPin() };
      mutated = true;
    }
    if (
      !next.recipientTrackingToken ||
      !RECIPIENT_TOKEN_REGEX.test(next.recipientTrackingToken.toLowerCase())
    ) {
      next = {
        ...next,
        recipientTrackingToken: generateSecureRecipientToken(),
        podTokenExpiresAt:
          next.podTokenExpiresAt || new Date(Date.now() + SEVEN_DAYS_MS).toISOString(),
      };
      mutated = true;
    }
    if (typeof next.podFailedAttempts !== 'number') {
      next = { ...next, podFailedAttempts: 0 };
      mutated = true;
    }
    return next;
  });

  return { records: normalized, mutated };
}

export const deliveryService = {
  /**
   * Retrieves all deliveries from localStorage in offline/demo mode, backfilling
   * non-destructive POD secrets on active records if absent.
   */
  getAllDeliveriesSync(): DeliveryRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: DeliveryRecord[] = raw
        ? JSON.parse(raw)
        : INITIAL_SEED_DELIVERIES.map((d) => ({ ...d }));
      const { records, mutated } = normalizeOfflineDeliveries(parsed);
      if (!raw || mutated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      }
      return records;
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
   */
  async getVendorDeliveries(vendorId: string): Promise<DeliveryRecord[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('deliveries')
          .select(`
            *,
            package_details (*),
            delivery_pod_secrets (pin_code, recipient_token, token_expires_at, token_revoked_at),
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
            delivery_pod_secrets (pin_code, recipient_token, token_expires_at, token_revoked_at),
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
   * Rejects `prepaid_online` until a verified payment gateway/webhook is integrated,
   * and enforces `paymentStatus = 'pending'` on all newly created orders.
   */
  async createDelivery(
    data: Omit<DeliveryRecord, 'id' | 'createdAt' | 'updatedAt'>,
    idempotencyKey?: string
  ): Promise<DeliveryRecord> {
    if (data.paymentMethod === 'prepaid_online') {
      throw new Error(
        'Online prepaid payment is unavailable until verified payment gateway integration is enabled.'
      );
    }

    if (data.status === 'delivered') {
      throw new Error('Cannot create a pre-completed delivery.');
    }

    const paymentMethod: PaymentMethod = data.paymentMethod ?? 'cash_on_delivery';
    const paymentStatus: PaymentStatus = 'pending';
    const requirePhotoProof = Boolean(data.requirePhotoProof);

    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const trackingCode = `OF-${randomNum}`;
    const now = new Date().toISOString();

    const isAuto =
      data.dispatchMode === 'auto' ||
      !data.providerId ||
      (isSupabaseConfigured && !isUuid(data.providerId));
    let initialStatus: DeliveryStatus =
      data.status || (isAuto ? 'opportunity_sent' : 'awaiting_pickup');

    if (isSupabaseConfigured) {
      let isLiveAuthSession = true;
      try {
        if (supabase.auth?.getSession) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData?.session?.user) {
            isLiveAuthSession = false;
          }
        }
      } catch {
        // Ignored in test environments where auth is mocked differently
      }

      if (isLiveAuthSession) {
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
          p_selected_provider_id:
            !isAuto && data.providerId && isUuid(data.providerId) ? data.providerId : null,
          p_candidate_provider_ids: candidateIds.length > 0 ? candidateIds : null,
          p_idempotency_key: idempotencyKey || null,
          p_payment_method: paymentMethod,
          p_require_photo_proof: requirePhotoProof,
        });

        const isSchemaCacheError =
          rpcErr?.code === 'PGRST202' ||
          Boolean(
            rpcErr?.message &&
              (rpcErr.message.includes('schema cache') ||
                rpcErr.message.includes('Could not find the function'))
          );

        if (isSchemaCacheError) {
          console.warn(
            'create_delivery_transactional RPC is not available in Supabase schema cache. Falling back to offline client store.',
            rpcErr?.message
          );
        } else if (rpcErr || !res || !res.success) {
          const errorMsg =
            rpcErr?.message ||
            (res as { error?: string })?.error ||
            'Database rejected delivery creation';
          console.error('deliveryService.createDelivery error:', errorMsg);
          throw new Error(errorMsg);
        } else {
          const createdLive: DeliveryRecord = {
            ...data,
            id: res.delivery_id,
            trackingCode: res.tracking_code,
            status: res.status as DeliveryStatus,
            providerId: res.provider_id || undefined,
            currentOpportunityProviderId: res.current_opportunity_provider_id || undefined,
            candidateQueue: res.candidate_provider_ids,
            paymentMethod: (res.payment_method as PaymentMethod | null) ?? paymentMethod,
            paymentStatus: (res.payment_status as PaymentStatus | null) ?? 'pending',
            podVerificationCode: res.pod_verification_code || undefined,
            recipientTrackingToken: res.recipient_tracking_token || undefined,
            podFailedAttempts: 0,
            requirePhotoProof:
              typeof res.require_photo_proof === 'boolean'
                ? res.require_photo_proof
                : requirePhotoProof,
            createdAt: res.created_at,
            updatedAt: res.updated_at || res.created_at,
          };

          realtimeService.notifyMutation('delivery', createdLive);
          realtimeService.notifyMutation('dispatch', createdLive);
          return createdLive;
        }
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
        initialStatus = data.status === 'in_transit' ? 'in_transit' : 'opportunity_sent';
      } else {
        initialStatus = data.status === 'in_transit' ? 'in_transit' : 'searching';
      }
    }

    const podVerificationCode =
      data.podVerificationCode && POD_PIN_REGEX.test(data.podVerificationCode)
        ? data.podVerificationCode
        : generateSecurePodPin();
    const recipientTrackingToken =
      data.recipientTrackingToken &&
      RECIPIENT_TOKEN_REGEX.test(data.recipientTrackingToken.toLowerCase())
        ? data.recipientTrackingToken.toLowerCase()
        : generateSecureRecipientToken();
    const podTokenExpiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();

    const newDelivery: DeliveryRecord = {
      ...data,
      id: trackingCode,
      trackingCode,
      status: initialStatus,
      paymentMethod,
      paymentStatus,
      podVerificationCode,
      recipientTrackingToken,
      podTokenExpiresAt,
      podTokenRevokedAt: null,
      podFailedAttempts: 0,
      requirePhotoProof,
      podPhotoUrl: undefined,
      podCompletedAt: undefined,
      candidateQueue: data.candidateQueue || candidateQueue,
      currentOpportunityProviderId:
        data.currentOpportunityProviderId || currentOpportunityProviderId,
      createdAt: now,
      updatedAt: now,
    };

    const all = this.getAllDeliveriesSync();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newDelivery, ...all]));
    } catch {
      // storage quota
    }

    realtimeService.notifyMutation('delivery', newDelivery);
    realtimeService.notifyMutation('dispatch', newDelivery);
    return newDelivery;
  },

  /**
   * Retrieves open delivery requests available for logistics providers in their coverage area.
   */
  async getProviderOpportunities(coverageArea?: string, providerId?: string): Promise<DeliveryRecord[]> {
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
      if (providerId && (d.providerId === providerId || d.selectedProvider?.id === providerId)) {
        return false;
      }
      const isAvailableStatus =
        d.status === 'created' ||
        d.status === 'searching' ||
        d.status === 'opportunity_sent' ||
        d.status === 'awaiting_pickup';
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
   * Couriers never receive `delivery_pod_secrets` rows.
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
            const accepted = await this.getDeliveryById(deliveryId);
            if (accepted) {
              realtimeService.notifyMutation('delivery', accepted);
              realtimeService.notifyMutation('dispatch', accepted);
            }
            return accepted;
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

    const all = this.getAllDeliveriesSync();
    const index = all.findIndex((d) => d.id === deliveryId || d.trackingCode === deliveryId);
    if (index === -1) return null;

    const target = all[index];
    if (
      (target.status === 'provider_selected' && target.providerId) ||
      target.status === 'in_transit' ||
      target.status === 'delivered' ||
      target.status === 'cancelled' ||
      target.providerId === providerId
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
            rating: 5.0,
            reviewCount: 0,
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

    realtimeService.notifyMutation('delivery', updatedRecord);
    realtimeService.notifyMutation('dispatch', updatedRecord);
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

          if (res?.success) {
            realtimeService.notifyMutation('dispatch', { deliveryId, providerId });
            return true;
          }
          return false;
        } catch (err) {
          console.error('deliveryService.declineOpportunity exception:', err);
          return false;
        }
      }
      return false;
    }

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

    realtimeService.notifyMutation('dispatch', { deliveryId, providerId });
    return true;
  },

  /**
   * Updates delivery status enforcing the state machine.
   * Rejects `delivered` — deliveries can only complete via `completeDeliveryWithPod`.
   */
  async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus,
    _userId?: string,
    notes?: string
  ): Promise<DeliveryRecord | null> {
    if (status === 'delivered') {
      console.warn(
        'deliveryService.updateDeliveryStatus rejected: use completeDeliveryWithPod to complete handover.'
      );
      return null;
    }

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
            const updated = await this.getDeliveryById(deliveryId);
            if (updated) {
              realtimeService.notifyMutation('delivery', updated);
            }
            return updated;
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

    const all = this.getAllDeliveriesSync();
    const index = all.findIndex((d) => d.id === deliveryId || d.trackingCode === deliveryId);
    if (index === -1) return null;

    const current = all[index];
    if (current.status === 'delivered' || current.status === 'cancelled') {
      return null;
    }

    const now = new Date().toISOString();
    const updatedRecord: DeliveryRecord = {
      ...current,
      status,
      podTokenRevokedAt:
        status === 'cancelled' ? current.podTokenRevokedAt || now : current.podTokenRevokedAt,
      updatedAt: now,
    };

    all[index] = updatedRecord;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // storage error
    }

    realtimeService.notifyMutation('delivery', updatedRecord);
    return updatedRecord;
  },

  /**
   * Completes a delivery with server-verified Proof of Delivery (POD).
   * - Never accepts hardcoded bypass codes (such as '0000').
   * - In live mode, delegates atomically to `complete_delivery_with_pod` RPC
   *   so couriers never read `delivery_pod_secrets` and failed attempts are
   *   counted server-side (5-attempt lockout).
   */
  async completeDeliveryWithPod(
    deliveryId: string,
    verificationCode: string,
    photoUrl?: string,
    notes?: string
  ): Promise<{
    success: boolean;
    code?: string;
    attemptsRemaining?: number;
    error?: string;
    delivery?: DeliveryRecord;
  }> {
    const cleanInputCode = (verificationCode || '').trim();
    const cleanPhotoUrl = photoUrl?.trim() ? photoUrl.trim() : undefined;

    if (isSupabaseConfigured) {
      if (!isUuid(deliveryId)) {
        return { success: false, error: 'Invalid delivery identifier.' };
      }

      try {
        const { data: res, error } = await supabase.rpc('complete_delivery_with_pod', {
          p_delivery_id: deliveryId,
          p_verification_code: cleanInputCode,
          p_photo_url: cleanPhotoUrl ?? null,
          p_notes: notes || null,
        });

        if (error) {
          console.error('deliveryService.completeDeliveryWithPod RPC error:', error.message);
          return {
            success: false,
            error: error.message || 'Failed to verify Proof of Delivery.',
          };
        }

        if (!res || !res.success) {
          return {
            success: false,
            code: res?.code,
            attemptsRemaining: res?.attempts_remaining,
            error:
              res?.error ||
              'Invalid 4-digit verification code. Please request the code from the recipient.',
          };
        }

        const refreshed = await this.getDeliveryById(deliveryId);
        if (refreshed) {
          realtimeService.notifyMutation('delivery', refreshed);
          return { success: true, delivery: refreshed };
        }

        return { success: true };
      } catch (err: any) {
        console.error('deliveryService.completeDeliveryWithPod exception:', err?.message || err);
        return {
          success: false,
          error: err?.message || 'Failed to verify Proof of Delivery.',
        };
      }
    }

    // Offline / Demo fallback — enforces identical validation, lockout, and COD rules
    const all = this.getAllDeliveriesSync();
    const index = all.findIndex((d) => d.id === deliveryId || d.trackingCode === deliveryId);
    if (index === -1) {
      return { success: false, code: 'not_found', error: 'Delivery record not found.' };
    }

    const target = all[index];

    if (target.status === 'delivered') {
      return {
        success: false,
        code: 'already_delivered',
        error: 'Delivery has already been marked as delivered.',
      };
    }

    if (target.status !== 'in_transit') {
      return {
        success: false,
        code: 'invalid_transition',
        error: `Delivery must be in_transit before completing handover (current status: ${target.status}).`,
      };
    }

    const currentAttempts = target.podFailedAttempts ?? 0;
    if (currentAttempts >= MAX_POD_FAILED_ATTEMPTS) {
      return {
        success: false,
        code: 'too_many_attempts',
        attemptsRemaining: 0,
        error: 'Too many failed PIN attempts. Ask the vendor to rotate the handover PIN.',
      };
    }

    if (
      !POD_PIN_REGEX.test(cleanInputCode) ||
      !target.podVerificationCode ||
      !timingSafeEqualString(target.podVerificationCode, cleanInputCode)
    ) {
      const nextAttempts = currentAttempts + 1;
      all[index] = {
        ...target,
        podFailedAttempts: nextAttempts,
        updatedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      } catch {
        // storage error
      }

      const lockedOut = nextAttempts >= MAX_POD_FAILED_ATTEMPTS;
      return {
        success: false,
        code: lockedOut ? 'too_many_attempts' : 'invalid_pin',
        attemptsRemaining: Math.max(0, MAX_POD_FAILED_ATTEMPTS - nextAttempts),
        error: lockedOut
          ? 'Too many failed PIN attempts. Ask the vendor to rotate the handover PIN.'
          : 'Invalid 4-digit verification code. Please request the code from the recipient.',
      };
    }

    if (target.requirePhotoProof && !cleanPhotoUrl) {
      return {
        success: false,
        code: 'photo_required',
        error:
          'Vendor has required photo proof of delivery. Please capture or upload a handover photo.',
      };
    }

    if (cleanPhotoUrl) {
      if (
        cleanPhotoUrl.length > MAX_POD_PHOTO_BYTES ||
        !POD_PHOTO_URL_REGEX.test(cleanPhotoUrl)
      ) {
        return {
          success: false,
          code: 'invalid_photo_url',
          error: 'Invalid or oversized proof-of-delivery photo.',
        };
      }
    }

    const podCompletedAt = new Date().toISOString();
    const nextPaymentStatus: PaymentStatus | undefined =
      target.paymentMethod === 'cash_on_delivery' && target.paymentStatus === 'pending'
        ? 'collected'
        : target.paymentStatus;

    const updatedRecord: DeliveryRecord = {
      ...target,
      status: 'delivered',
      paymentStatus: nextPaymentStatus,
      podPhotoUrl: cleanPhotoUrl,
      podCompletedAt,
      updatedAt: podCompletedAt,
    };

    all[index] = updatedRecord;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // storage error
    }

    realtimeService.notifyMutation('delivery', updatedRecord);
    return { success: true, delivery: updatedRecord };
  },

  /**
   * Rotates the 4-digit recipient handover PIN and 64-hex tracking capability
   * token (revoking any previous recipient link) and resets failed PIN attempts.
   */
  async rotateDeliveryPodSecrets(deliveryId: string): Promise<{
    success: boolean;
    error?: string;
    podVerificationCode?: string;
    recipientTrackingToken?: string;
    tokenExpiresAt?: string;
  }> {
    if (isSupabaseConfigured) {
      if (!isUuid(deliveryId)) {
        return { success: false, error: 'Invalid delivery identifier.' };
      }

      try {
        const { data: res, error } = await supabase.rpc('rotate_delivery_pod_secrets', {
          p_delivery_id: deliveryId,
        });

        if (error) {
          console.error('deliveryService.rotateDeliveryPodSecrets error:', error.message);
          return { success: false, error: error.message || 'Failed to rotate handover PIN.' };
        }

        if (!res || !res.success) {
          return {
            success: false,
            error: res?.error || 'Unable to rotate handover PIN for this delivery.',
          };
        }

        const refreshed = await this.getDeliveryById(deliveryId);
        if (refreshed) {
          realtimeService.notifyMutation('delivery', refreshed);
        }

        return {
          success: true,
          podVerificationCode: res.pod_verification_code,
          recipientTrackingToken: res.recipient_tracking_token,
          tokenExpiresAt: res.token_expires_at,
        };
      } catch (err: any) {
        console.error('deliveryService.rotateDeliveryPodSecrets exception:', err?.message || err);
        return { success: false, error: err?.message || 'Failed to rotate handover PIN.' };
      }
    }

    const all = this.getAllDeliveriesSync();
    const index = all.findIndex((d) => d.id === deliveryId || d.trackingCode === deliveryId);
    if (index === -1) {
      return { success: false, error: 'Delivery not found.' };
    }

    const target = all[index];
    if (target.status === 'delivered' || target.status === 'cancelled') {
      return {
        success: false,
        error: 'Cannot rotate handover secrets for a delivered or cancelled order.',
      };
    }

    const newPin = generateSecurePodPin();
    const newToken = generateSecureRecipientToken();
    const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();

    const updatedRecord: DeliveryRecord = {
      ...target,
      podVerificationCode: newPin,
      recipientTrackingToken: newToken,
      podTokenExpiresAt: expiresAt,
      podTokenRevokedAt: null,
      podFailedAttempts: 0,
      updatedAt: new Date().toISOString(),
    };

    all[index] = updatedRecord;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // storage error
    }

    realtimeService.notifyMutation('delivery', updatedRecord);
    return {
      success: true,
      podVerificationCode: newPin,
      recipientTrackingToken: newToken,
      tokenExpiresAt: expiresAt,
    };
  },

  /**
   * Secure, privacy-safe public tracking function implementing Case A / B / C
   * disclosure rules:
   * - Case A (no recipientToken): returns ONLY non-sensitive milestone metadata;
   *   all payment, COD amount, PIN, and POD photo fields are `null`.
   * - Case B (valid, unexpired, non-revoked 64-hex recipientToken): returns
   *   recipient payment summary, active handover PIN (extinguished immediately
   *   upon `delivered` or `cancelled`), and POD photo only once `delivered`.
   * - Case C (invalid, expired, or revoked token): identical disclosure to Case A
   *   (`recipientAccessGranted: false`, all sensitive fields `null`).
   */
  async getPublicTracking(
    trackingCode: string,
    recipientToken?: string | null
  ): Promise<PublicTrackingInfo | null> {
    const cleanCode = trackingCode.trim();
    if (!cleanCode) return null;

    const normalizedToken = recipientToken?.trim().toLowerCase() || null;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('get_public_tracking', {
          p_tracking_code: cleanCode,
          p_recipient_token: normalizedToken,
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
            recipientAccessGranted: Boolean(row.recipient_access_granted),
            paymentMethod: row.payment_method ?? null,
            paymentStatus: row.payment_status ?? null,
            amountDue: row.amount_due ?? null,
            requirePhotoProof: row.require_photo_proof ?? null,
            hasPhotoProof: row.has_photo_proof ?? null,
            podPhotoUrl: row.pod_photo_url ?? null,
            podVerificationCode: row.pod_verification_code ?? null,
          };
        }
      } catch (err) {
        console.warn('deliveryService.getPublicTracking error, using fallback:', err);
      }
    }

    // Offline / Demo fallback — strictly enforces Case A / B / C disclosure rules
    const all = this.getAllDeliveriesSync();
    const target = all.find(
      (d) =>
        d.id.toLowerCase() === cleanCode.toLowerCase() ||
        (d.trackingCode && d.trackingCode.toLowerCase() === cleanCode.toLowerCase())
    );

    if (!target) return null;

    const storedToken = target.recipientTrackingToken?.trim().toLowerCase() || null;
    const isTokenFormatValid = Boolean(
      normalizedToken && RECIPIENT_TOKEN_REGEX.test(normalizedToken)
    );
    const isNotRevoked = !target.podTokenRevokedAt;
    const isNotExpired =
      !target.podTokenExpiresAt || new Date(target.podTokenExpiresAt).getTime() > Date.now();
    const isAuthorized = Boolean(
      isTokenFormatValid &&
        storedToken &&
        normalizedToken &&
        timingSafeEqualString(storedToken, normalizedToken) &&
        isNotRevoked &&
        isNotExpired &&
        target.status !== 'cancelled'
    );

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
      recipientAccessGranted: isAuthorized,
      paymentMethod: isAuthorized ? (target.paymentMethod ?? null) : null,
      paymentStatus: isAuthorized ? (target.paymentStatus ?? null) : null,
      amountDue:
        isAuthorized &&
        target.paymentMethod === 'cash_on_delivery' &&
        target.paymentStatus === 'pending' &&
        target.status !== 'delivered'
          ? target.estimatedPrice
          : null,
      requirePhotoProof: isAuthorized ? Boolean(target.requirePhotoProof) : null,
      hasPhotoProof: isAuthorized ? Boolean(target.podPhotoUrl) : null,
      podPhotoUrl:
        isAuthorized && target.status === 'delivered' ? (target.podPhotoUrl ?? null) : null,
      podVerificationCode:
        isAuthorized && target.status !== 'delivered' && target.status !== 'cancelled'
          ? (target.podVerificationCode ?? null)
          : null,
    };
  },

  /**
   * Retrieves full delivery details by tracking code (for authenticated vendor/provider views).
   */
  async getDeliveryByTrackingCode(code: string): Promise<DeliveryRecord | null> {
    return this.getDeliveryById(code);
  },

  /**
   * Realtime subscriptions delegated to realtimeService
   */
  subscribeToProviderDispatches(providerId: string, onUpdate: (payload?: unknown) => void): () => void {
    return realtimeService.subscribeToProviderDispatches(providerId, onUpdate);
  },

  subscribeToVendorDeliveries(vendorId: string, onUpdate: (payload?: unknown) => void): () => void {
    return realtimeService.subscribeToVendorDeliveries(vendorId, onUpdate);
  },

  subscribeToDelivery(deliveryId: string, onUpdate: (payload?: unknown) => void): () => void {
    return realtimeService.subscribeToDelivery(deliveryId, onUpdate);
  },
};
