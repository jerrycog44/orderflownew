/* OrderFlow TypeScript Domain Model Definitions */

export type DeliveryStatus =
  | 'draft'
  | 'searching'
  | 'opportunity_sent'
  | 'created'
  | 'provider_selected'
  | 'awaiting_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export type UserRole = 'vendor' | 'logistics_provider';

export type PackageType = 'parcel' | 'box' | 'bag' | 'fragile_item' | 'other';

export type ProviderAvailability = 'available' | 'busy' | 'unavailable';

// ---------------------------------------------------------------------------
// User & Account Models
// ---------------------------------------------------------------------------

/**
 * Core user identity — shared across web and future WhatsApp integration.
 * Phone is required as it is the future WhatsApp identity key.
 */
export interface User {
  id: string;                        // UUID — stable across all platforms
  fullName: string;
  email: string;
  phone: string;                     // Required — WhatsApp compatibility
  role: UserRole | null;             // null until role is selected post-signup
  onboardingCompleted: boolean;
  createdAt: string;                 // ISO 8601
  updatedAt: string;                 // ISO 8601
}

/**
 * Vendor-specific profile — linked to User by userId.
 * Kept separate from User to support clean relational backend model.
 */
export interface VendorProfile {
  userId: string;
  businessName: string;
  businessCategory: string;
  operatingCity: string;
  createdAt: string;
}

/**
 * Logistics provider profile — linked to User by userId.
 */
export interface LogisticsProviderProfile {
  userId: string;
  providerName: string;
  providerType: 'courier' | 'freight' | 'van' | 'motorcycle' | 'mixed';
  coverageArea: string;
  vehicleTypes: string[];
  packageCategories: string[];
  availability: ProviderAvailability;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Delivery Domain Models
// ---------------------------------------------------------------------------

export interface PackageDetails {
  productName: string;
  itemCategory: string;
  packageType: PackageType;
  quantity: number;
  weightKg: number;
  dimensionsCm: {
    length: number;
    width: number;
    height: number;
  };
  fragile: boolean;
  imageUrl?: string;
  notes?: string;
}

export interface LocationPoint {
  address: string;
  city: string;
  area?: string;
  contactName?: string;
  contactPhone?: string;
}

export interface LogisticsProvider {
  id: string;
  name: string;
  logoUrl?: string;
  availability: ProviderAvailability;
  serviceAreas: string[];
  estimatedPrice: number;
  currency: string;
  estimatedDeliveryTime: string;
  vehicleTypes: string[];
  supportedPackageTypes: PackageType[];
  rating: number;
  reviewCount: number;
  capacity: string;
  recommendationTag?: string; // e.g. "Best match for package", "Fastest option", "Lowest estimated price"
  recommendationReason?: string;
}

/**
 * DeliveryRecord represents a complete delivery request throughout its lifecycle.
 */
export interface DeliveryRecord {
  id: string;                         // e.g. OF-849201
  vendorId: string;
  vendorName: string;
  providerId?: string;
  selectedProvider?: LogisticsProvider;
  productName: string;
  package: PackageDetails;
  pickup: LocationPoint;
  destination: LocationPoint;
  recipient: {
    name: string;
    phone: string;
  };
  deliveryNote?: string;
  status: DeliveryStatus;
  dispatchMode?: 'auto' | 'manual';
  currentOpportunityProviderId?: string;
  candidateQueue?: string[];
  declinedProviderIds?: string[];
  assignedDriver?: {
    name: string;
    phone: string;
    vehiclePlate?: string;
  };
  estimatedPrice: number;
  estimatedDeliveryTime: string;
  createdAt: string;
  updatedAt: string;
}

// Backward compatibility interface
export interface DeliveryRequest extends DeliveryRecord {}

// ---------------------------------------------------------------------------
// UI State Models
// ---------------------------------------------------------------------------

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}
