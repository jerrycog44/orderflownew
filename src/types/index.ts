/* OrderFlow TypeScript Domain Model Definitions */

import type { Enums } from './database.types';

// Enum-like unions are derived from the database schema so the domain model
// and Postgres enums can never drift apart.
export type DeliveryStatus = Enums<'delivery_status'>;

export type UserRole = Enums<'user_role'>;

export type PackageType = Enums<'package_type_enum'>;

export type ProviderAvailability = Enums<'availability_status'>;

// ---------------------------------------------------------------------------
// User & Account Models
// ---------------------------------------------------------------------------

/**
 * Core user identity — shared across web and future WhatsApp integration.
 * Phone is the future WhatsApp identity key. It is nullable because the
 * database (migration 002) allows profiles to exist before phone is confirmed.
 */
export interface User {
  id: string;                        // UUID — stable across all platforms
  fullName: string;
  email: string;
  phone: string | null;              // null until captured/confirmed
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

// ---------------------------------------------------------------------------
// Payment & Proof of Delivery (POD) Models
// ---------------------------------------------------------------------------

export type PaymentMethod = 'cash_on_delivery' | 'pay_at_pickup' | 'prepaid_online';
export type PaymentStatus = 'pending' | 'collected' | 'remitted';

export interface ProofOfDeliveryDetails {
  verificationCode: string;
  requirePhotoProof: boolean;
  photoUrl?: string;
  completedAt?: string;
}

/**
 * DeliveryRecord represents a complete delivery request throughout its lifecycle.
 */
export interface DeliveryRecord {
  id: string;                         // e.g. OF-849201 or UUID
  trackingCode?: string;              // e.g. OF-849201
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
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  podVerificationCode?: string;
  requirePhotoProof?: boolean;
  podPhotoUrl?: string;
  podCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Backward compatibility interface
export interface DeliveryRequest extends DeliveryRecord {}

/**
 * Public, privacy-safe tracking information exposed to unauthenticated visitors.
 * Strictly excludes customer phone numbers, street addresses, and internal pricing.
 */
export interface PublicTrackingInfo {
  trackingCode: string;
  status: DeliveryStatus;
  estimatedDeliveryTime: string | null;
  createdAt: string;
  updatedAt: string;
  productName: string;
  vendorName: string;
  providerName: string | null;
  providerLogoUrl: string | null;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  amountDue?: number;
  podVerificationCode?: string | null;
  requirePhotoProof?: boolean;
  hasPhotoProof?: boolean;
  podPhotoUrl?: string | null;
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
