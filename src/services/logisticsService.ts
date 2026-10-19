import type {
  PackageDetails,
  LocationPoint,
  LogisticsProvider,
  ProviderAvailability,
  LogisticsProviderProfile,
  VendorProfile,
  PackageType,
} from '../types';
import { MOCK_LOGISTICS_PROVIDERS } from '../data/mockProviders';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface DeliveryRequestFormInput {
  package: PackageDetails;
  pickup: LocationPoint;
  destination: LocationPoint;
}

export const logisticsService = {
  /**
   * Retrieves logistics providers. When live Supabase credentials are configured,
   * queries the `logistics_providers` table joined with real-time `provider_availability`.
   * Falls back to seed providers in offline/demo mode.
   */
  async getProviders(): Promise<LogisticsProvider[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('logistics_providers')
          .select(`
            *,
            provider_availability (status)
          `);

        if (!error && data && data.length > 0) {
          return data.map((row): LogisticsProvider => {
            const availObj = Array.isArray(row.provider_availability)
              ? row.provider_availability[0]
              : row.provider_availability;
            const availStatus = (availObj?.status as ProviderAvailability) || 'available';
            const serviceAreas = row.service_areas && row.service_areas.length > 0
              ? row.service_areas
              : [row.coverage_area];

            return {
              id: row.id,
              name: row.provider_name,
              logoUrl: row.logo_url || undefined,
              availability: availStatus,
              serviceAreas,
              estimatedPrice: 3500,
              currency: 'NGN',
              estimatedDeliveryTime: 'Same Day (2–4 hours)',
              vehicleTypes: row.vehicle_types && row.vehicle_types.length > 0
                ? row.vehicle_types
                : ['Motorcycle'],
              supportedPackageTypes: (row.package_categories && row.package_categories.length > 0
                ? row.package_categories
                : ['parcel', 'box', 'bag']) as PackageType[],
              rating: row.rating || 4.8,
              reviewCount: row.review_count || 120,
              capacity: 'Standard Fleet',
            };
          });
        }
      } catch (err) {
        console.warn('logisticsService.getProviders: Falling back to seed providers due to fetch error:', err);
      }
    }

    // Offline / Mock fallback: populate with local dynamic availability
    return MOCK_LOGISTICS_PROVIDERS.map((provider) => {
      const dynamicAvail = this.getDynamicAvailability(provider.id);
      return dynamicAvail ? { ...provider, availability: dynamicAvail } : provider;
    });
  },

  /**
   * Synchronously evaluates delivery parameters against a pool of logistics providers,
   * calculating suitability scores, route coverage, and recommendation tags.
   */
  recommendLogisticsProviders(
    input: DeliveryRequestFormInput,
    providerPool?: LogisticsProvider[]
  ): LogisticsProvider[] {
    const { package: pkg, pickup, destination } = input;
    const pool = providerPool && providerPool.length > 0
      ? providerPool
      : MOCK_LOGISTICS_PROVIDERS.map((p) => {
          const dynamicAvail = this.getDynamicAvailability(p.id);
          return dynamicAvail ? { ...p, availability: dynamicAvail } : p;
        });

    // Filter and compute suitability scores
    const evaluatedProviders = pool.map((provider) => {
      let isCovered = true;
      const pCity = (pickup.city || '').trim().toLowerCase();
      const dCity = (destination.city || '').trim().toLowerCase();

      // Check coverage matching
      const providerAreasLower = provider.serviceAreas.map((a) => a.toLowerCase());
      if (pCity && !providerAreasLower.some((a) => a.includes(pCity) || pCity.includes(a))) {
        isCovered = false;
      }
      if (dCity && !providerAreasLower.some((a) => a.includes(dCity) || dCity.includes(a))) {
        isCovered = false;
      }

      // Check package type support
      const supportsType = provider.supportedPackageTypes.includes(pkg.packageType);

      // Adjust price estimate based on weight & city match
      let price = provider.estimatedPrice || 3500;
      if (pCity !== dCity && pCity && dCity) {
        // Inter-state delivery surcharge
        price = Math.round(price * 1.8);
      }
      if (pkg.weightKg > 10) {
        price += Math.round((pkg.weightKg - 10) * 200);
      }

      // Assign calculated status & score
      let statusScore = 0;
      if (provider.availability === 'available') statusScore += 100;
      else if (provider.availability === 'busy') statusScore += 40;
      else statusScore -= 100;

      if (isCovered) statusScore += 50;
      if (supportsType) statusScore += 20;

      // Heavy cargo preference
      if (pkg.weightKg > 25 && provider.vehicleTypes.some((v) => v.includes('Truck') || v.includes('Van'))) {
        statusScore += 40;
      }

      return {
        ...provider,
        estimatedPrice: price,
        isCovered,
        score: statusScore,
      };
    });

    // Sort by status score descending
    evaluatedProviders.sort((a, b) => b.score - a.score);

    // Find min price & min transit time among available & covered providers
    const eligible = evaluatedProviders.filter((p) => p.availability === 'available' && p.isCovered);
    const minPrice = eligible.length > 0 ? Math.min(...eligible.map((p) => p.estimatedPrice)) : 0;

    // Decorate with recommendation tags
    return evaluatedProviders.map((provider, index) => {
      let tag = provider.recommendationTag;
      let reason = provider.recommendationReason;

      if (provider.availability === 'unavailable' || !provider.isCovered) {
        tag = 'Outside service area';
        reason = 'Provider currently does not support this pickup or destination location.';
      } else if (provider.availability === 'busy') {
        tag = 'High dispatch load';
        reason = 'Drivers currently active. Pickup timing may experience slight delay.';
      } else if (index === 0) {
        tag = 'Best match for package';
        reason = `Optimal vehicle match (${provider.vehicleTypes[0] || 'courier'}) and immediate pickup availability.`;
      } else if (provider.estimatedPrice === minPrice && minPrice > 0) {
        tag = 'Lowest estimated price';
        reason = 'Most cost-effective logistics rate for your specified package dimensions.';
      } else if (provider.estimatedDeliveryTime.includes('1 hour') || provider.estimatedDeliveryTime.includes('1–2')) {
        tag = 'Fastest transit option';
        reason = 'Priority express courier with direct point-to-point dispatch.';
      }

      const { score, isCovered, ...cleanProvider } = provider;
      void score;
      void isCovered;
      return {
        ...cleanProvider,
        recommendationTag: tag,
        recommendationReason: reason,
      };
    });
  },

  /**
   * Asynchronously fetches live registered providers and evaluates recommendations.
   */
  async getRecommendedProviders(input: DeliveryRequestFormInput): Promise<LogisticsProvider[]> {
    const providers = await this.getProviders();
    return this.recommendLogisticsProviders(input, providers);
  },

  /**
   * Get single provider by ID (asynchronous with live database lookup and offline fallback).
   */
  async getProviderById(id: string): Promise<LogisticsProvider | undefined> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('logistics_providers')
          .select(`
            *,
            provider_availability (status)
          `)
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          const availStatus = (data.provider_availability?.status as ProviderAvailability) || 'available';
          return {
            id: data.id,
            name: data.provider_name,
            logoUrl: data.logo_url || undefined,
            availability: availStatus,
            serviceAreas: data.service_areas || [data.coverage_area],
            estimatedPrice: 3500,
            currency: 'NGN',
            estimatedDeliveryTime: 'Same Day (2–4 hours)',
            vehicleTypes: data.vehicle_types || ['Motorcycle'],
            supportedPackageTypes: (data.package_categories || ['parcel']) as PackageType[],
            rating: data.rating || 4.8,
            reviewCount: data.review_count || 120,
            capacity: 'Standard Fleet',
          };
        }
      } catch (err) {
        console.warn('logisticsService.getProviderById: Database lookup failed, using fallback:', err);
      }
    }

    return this.getProviderByIdSync(id);
  },

  /**
   * Synchronous provider lookup from mock seed data (preserves synchronous caller compatibility).
   */
  getProviderByIdSync(id: string): LogisticsProvider | undefined {
    const base = MOCK_LOGISTICS_PROVIDERS.find((p) => p.id === id);
    if (!base) return undefined;
    const dynamicAvail = this.getDynamicAvailability(id);
    return dynamicAvail ? { ...base, availability: dynamicAvail } : base;
  },

  /**
   * Checks localStorage for dynamically updated provider availability status in demo mode.
   */
  getDynamicAvailability(providerId: string): ProviderAvailability | null {
    try {
      const saved = localStorage.getItem(`of_dev_availability_${providerId}`);
      if (saved === 'available' || saved === 'busy' || saved === 'unavailable') {
        return saved;
      }
    } catch {
      // storage error fallback
    }
    return null;
  },

  /**
   * Updates provider availability in the live database and persists to local demo storage.
   */
  async updateProviderAvailability(
    providerId: string,
    status: ProviderAvailability
  ): Promise<boolean> {
    // Write to local demo storage
    try {
      localStorage.setItem(`of_dev_availability_${providerId}`, status);
    } catch {
      // storage quota or disabled
    }

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('provider_availability')
          .upsert(
            {
              provider_id: providerId,
              status,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'provider_id' }
          );

        if (error) {
          console.error('logisticsService.updateProviderAvailability: Supabase upsert error:', error);
          return false;
        }
        return true;
      } catch (err) {
        console.error('logisticsService.updateProviderAvailability exception:', err);
        return false;
      }
    }

    return true;
  },

  /**
   * Evaluates delivery specifications and produces an ordered list of eligible provider candidates
   * for automated targeted dispatching. Excludes busy or offline/unavailable providers, unsupported areas,
   * and already-declined providers.
   */
  buildCandidateQueue(
    input: DeliveryRequestFormInput,
    excludedProviderIds: string[] = [],
    providerPool?: LogisticsProvider[]
  ): LogisticsProvider[] {
    const recommended = this.recommendLogisticsProviders(input, providerPool);
    const excludedSet = new Set(excludedProviderIds);

    // Filter strictly for eligible candidates:
    // 1. Must NOT be in excluded/declined IDs
    // 2. Must be 'available' (Online) — excluded if 'busy' or 'unavailable' (Offline)
    // 3. Must cover the city area
    return recommended.filter((p) => {
      const currentAvailability = this.getDynamicAvailability(p.id) || p.availability;
      if (excludedSet.has(p.id)) return false;
      if (currentAvailability === 'unavailable' || currentAvailability === 'busy') return false;
      if (p.recommendationTag === 'Outside service area') return false;
      return true;
    });
  },

  /**
   * Asynchronously builds a candidate queue querying live available providers.
   */
  async getCandidateQueue(
    input: DeliveryRequestFormInput,
    excludedProviderIds: string[] = []
  ): Promise<LogisticsProvider[]> {
    const providers = await this.getProviders();
    return this.buildCandidateQueue(input, excludedProviderIds, providers);
  },

  /**
   * Loads a logistics provider profile from Supabase `logistics_providers` table
   * with fallback to local development mock storage.
   */
  async getProviderProfile(userId: string): Promise<LogisticsProviderProfile | null> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('logistics_providers')
          .select(`
            *,
            provider_availability (status)
          `)
          .eq('id', userId)
          .maybeSingle();

        if (!error && data) {
          return {
            userId: data.id,
            providerName: data.provider_name,
            providerType: (data.provider_type as LogisticsProviderProfile['providerType']) || 'courier',
            coverageArea: data.coverage_area,
            vehicleTypes: data.vehicle_types,
            packageCategories: data.package_categories,
            availability:
              ((Array.isArray(data.provider_availability)
                ? data.provider_availability[0]?.status
                : data.provider_availability?.status) as ProviderAvailability) || 'available',
            createdAt: data.created_at,
          };
        }
      } catch (err) {
        console.warn('logisticsService.getProviderProfile: Supabase fetch failed, falling back:', err);
      }
    }

    try {
      const raw = localStorage.getItem('of_dev_provider_profiles');
      if (raw) {
        const profiles: Record<string, LogisticsProviderProfile> = JSON.parse(raw);
        return profiles[userId] || null;
      }
    } catch {
      // storage error
    }
    return null;
  },

  /**
   * Loads a vendor profile from Supabase `vendors` table
   * with fallback to local development mock storage.
   */
  async getVendorProfile(userId: string): Promise<VendorProfile | null> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!error && data) {
          return {
            userId: data.id,
            businessName: data.business_name,
            businessCategory: data.business_category,
            operatingCity: data.operating_city,
            createdAt: data.created_at,
          };
        }
      } catch (err) {
        console.warn('logisticsService.getVendorProfile: Supabase fetch failed, falling back:', err);
      }
    }

    try {
      const raw = localStorage.getItem('of_dev_vendor_profiles');
      if (raw) {
        const profiles: Record<string, VendorProfile> = JSON.parse(raw);
        return profiles[userId] || null;
      }
    } catch {
      // storage error
    }
    return null;
  },
};
