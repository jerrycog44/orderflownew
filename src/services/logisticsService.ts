import type { PackageDetails, LocationPoint, LogisticsProvider } from '../types';
import { MOCK_LOGISTICS_PROVIDERS } from '../data/mockProviders';

export interface DeliveryRequestFormInput {
  package: PackageDetails;
  pickup: LocationPoint;
  destination: LocationPoint;
}

export const logisticsService = {
  /**
   * Evaluates delivery parameters and returns available logistics providers,
   * sorted deterministically with recommendation tags.
   */
  recommendLogisticsProviders(input: DeliveryRequestFormInput): LogisticsProvider[] {
    const { package: pkg, pickup, destination } = input;

    // Filter and compute suitability scores
    const evaluatedProviders = MOCK_LOGISTICS_PROVIDERS.map((provider) => {
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
      let price = provider.estimatedPrice;
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
        reason = `Optimal vehicle match (${provider.vehicleTypes[0]}) and immediate pickup availability.`;
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
   * Get single provider by ID
   */
  getProviderById(id: string): LogisticsProvider | undefined {
    const base = MOCK_LOGISTICS_PROVIDERS.find((p) => p.id === id);
    if (!base) return undefined;
    const dynamicAvail = this.getDynamicAvailability(id);
    return dynamicAvail ? { ...base, availability: dynamicAvail } : base;
  },

  /**
   * Checks localStorage for dynamically updated provider availability status.
   */
  getDynamicAvailability(providerId: string): LogisticsProvider['availability'] | null {
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
   * Evaluates delivery specifications and produces an ordered list of eligible provider candidates
   * for automated targeted dispatching. Excludes busy or offline/unavailable providers, unsupported areas,
   * and already-declined providers.
   */
  buildCandidateQueue(
    input: DeliveryRequestFormInput,
    excludedProviderIds: string[] = []
  ): LogisticsProvider[] {
    const recommended = this.recommendLogisticsProviders(input);
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
};
