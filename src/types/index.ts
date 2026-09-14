/* OrderFlow TypeScript Domain Model Definitions */

export type DeliveryStatus = 'created' | 'matched' | 'in_transit' | 'delivered';

export type UserRole = 'vendor' | 'logistics_provider';

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
  availability: 'available' | 'unavailable';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Delivery Domain Models
// ---------------------------------------------------------------------------

export interface PackageDetails {
  weightKg: number;
  dimensionsCm: {
    length: number;
    width: number;
    height: number;
  };
  itemCategory: string;
  fragile: boolean;
  notes?: string;
}

export interface LocationPoint {
  address: string;
  city: string;
  postalCode?: string;
  contactName: string;
  contactPhone: string;
}

export interface LogisticsProviderOption {
  id: string;
  companyName: string;
  logoUrl?: string;
  rating: number;
  completedJobs: number;
  estimatedTransitTime: string;
  priceAmount: number;
  currency: string;
  features: string[];
  recommended?: boolean;
}

export interface DeliveryRequest {
  id: string;
  trackingNumber: string;
  status: DeliveryStatus;
  createdAt: string;
  package: PackageDetails;
  pickup: LocationPoint;
  destination: LocationPoint;
  selectedProvider?: LogisticsProviderOption;
}

// ---------------------------------------------------------------------------
// UI State Models
// ---------------------------------------------------------------------------

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}
