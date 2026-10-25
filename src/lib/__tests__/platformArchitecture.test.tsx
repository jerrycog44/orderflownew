import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { isNativePlatform, getPlatformType, initPlatform } from '../platform';
import { VendorDashboardPage } from '../../pages/VendorDashboardPage';
import { ProviderDashboardPage } from '../../pages/ProviderDashboardPage';
import { deliveryService } from '../../services/deliveryService';
import { logisticsService } from '../../services/logisticsService';
import type { DeliveryRecord, VendorProfile, LogisticsProviderProfile, User } from '../../types';

// Mock Vendor User
const mockVendorUser: User = {
  id: 'vendor-arch-123',
  fullName: 'Adaeze Okonjo',
  email: 'adaeze@zenithretail.ng',
  phone: '+2348011223344',
  role: 'vendor',
  onboardingCompleted: true,
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-20T10:00:00Z',
};

const mockSignOut = vi.fn();
const mockSetRole = vi.fn().mockResolvedValue({ error: null });

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockVendorUser,
    signOut: mockSignOut,
    setRole: mockSetRole,
    role: 'vendor',
    isAuthenticated: true,
    isLoading: false,
    hasCompletedOnboarding: true,
  }),
  useOptionalAuth: () => ({
    user: mockVendorUser,
    signOut: mockSignOut,
    setRole: mockSetRole,
    role: 'vendor',
    isAuthenticated: true,
    isLoading: false,
    hasCompletedOnboarding: true,
  }),
}));

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

const mockVendorProfile: VendorProfile = {
  userId: 'vendor-arch-123',
  businessName: 'Zenith Logistics Hub',
  businessCategory: 'Commerce & Retail',
  operatingCity: 'Lagos Island',
  createdAt: '2026-10-20T10:00:00Z',
};

const sampleDeliveries: DeliveryRecord[] = [
  {
    id: 'del-arch-001',
    trackingCode: 'OF-ARC-01',
    vendorId: 'vendor-arch-123',
    vendorName: 'Zenith Hub',
    productName: 'Mechanical Keyboard',
    package: {
      productName: 'Mechanical Keyboard',
      itemCategory: 'Electronics',
      packageType: 'box',
      quantity: 1,
      weightKg: 1.1,
      dimensionsCm: { length: 35, width: 15, height: 5 },
      fragile: true,
    },
    pickup: { address: '10 Broad Street', city: 'Lagos' },
    destination: { address: '15 Commercial Ave', city: 'Yaba' },
    recipient: { name: 'Chidi Mokeme', phone: '+2348055551122' },
    status: 'in_transit',
    estimatedPrice: 3200,
    estimatedDeliveryTime: 'Today',
    createdAt: '2026-10-24T10:00:00Z',
    updatedAt: '2026-10-24T10:00:00Z',
  },
];

const mockProviderProfile: LogisticsProviderProfile = {
  userId: 'provider-arch-456',
  providerName: 'Express Fleet Ibadan',
  providerType: 'courier',
  coverageArea: 'Ibadan Metro',
  vehicleTypes: ['motorcycle'],
  packageCategories: ['parcel'],
  availability: 'available',
  createdAt: '2026-10-20T10:00:00Z',
};

describe('Application Architecture & Platform Distinction', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    vi.spyOn(logisticsService, 'getVendorProfile').mockResolvedValue(mockVendorProfile);
    vi.spyOn(deliveryService, 'getVendorDeliveries').mockResolvedValue(sampleDeliveries);
    vi.spyOn(logisticsService, 'getProviderProfile').mockResolvedValue(mockProviderProfile);
    vi.spyOn(deliveryService, 'getProviderTargetedOpportunity').mockResolvedValue(null);
    vi.spyOn(deliveryService, 'getProviderOpportunities').mockResolvedValue([]);
    vi.spyOn(deliveryService, 'getProviderAssignedDeliveries').mockResolvedValue([]);
    vi.spyOn(deliveryService, 'subscribeToVendorDeliveries').mockReturnValue(() => {});
    vi.spyOn(deliveryService, 'subscribeToProviderDispatches').mockReturnValue(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('1. Platform Detection (src/lib/platform.ts)', () => {
    it('detects standard web environment when Capacitor is absent', () => {
      expect(isNativePlatform()).toBe(false);
      expect(getPlatformType()).toBe('web');

      initPlatform();
      expect(document.documentElement.classList.contains('platform-web')).toBe(true);
      expect(document.documentElement.classList.contains('platform-native')).toBe(false);
    });

    it('detects native Capacitor Android container when Capacitor runtime is injected', () => {
      (window as unknown as { Capacitor: { isNativePlatform: () => boolean; getPlatform: () => string } }).Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
      };

      expect(isNativePlatform()).toBe(true);
      expect(getPlatformType()).toBe('android');

      initPlatform();
      expect(document.documentElement.classList.contains('platform-native')).toBe(true);
      expect(document.documentElement.classList.contains('platform-web')).toBe(false);
    });

    it('supports developer override via localStorage for local testing', () => {
      localStorage.setItem('of_platform_mode', 'native');
      expect(isNativePlatform()).toBe(true);

      localStorage.setItem('of_platform_mode', 'web');
      expect(isNativePlatform()).toBe(false);
    });
  });

  describe('2. Universal Web Application: Vendor Dashboard Adaptation', () => {
    it('renders merchant dashboard with view switcher (Cards and Table)', async () => {
      render(
        <MemoryRouter>
          <VendorDashboardPage />
        </MemoryRouter>
      );

      // Wait for async fetch to finish and card to be rendered
      await waitFor(() => {
        expect(screen.getByTestId('delivery-job-card-OF-ARC-01')).toBeInTheDocument();
      });

      // Default is card view
      expect(screen.getByTestId('merchant-active-list')).toBeInTheDocument();

      // Click Table view switcher
      const tableBtn = screen.getByRole('button', { name: /table view/i });
      fireEvent.click(tableBtn);

      // Now desktop table view is rendered
      expect(screen.getByTestId('merchant-table-view')).toBeInTheDocument();
      expect(screen.getByText('Mechanical Keyboard')).toBeInTheDocument();
      expect(screen.getByText('Lagos')).toBeInTheDocument();
      expect(screen.getByText('Yaba')).toBeInTheDocument();
      expect(screen.getByText('Chidi Mokeme')).toBeInTheDocument();
      expect(screen.getByText('₦3,200')).toBeInTheDocument();

      // Switch back to Cards view
      const cardsBtn = screen.getByRole('button', { name: /cards view/i });
      fireEvent.click(cardsBtn);
      expect(screen.getByTestId('merchant-active-list')).toBeInTheDocument();
    });
  });

  describe('3. Universal Web Application: Provider Operational Cockpit', () => {
    it('renders provider cockpit with operational sidebar and dispatches main panel', async () => {
      render(
        <MemoryRouter>
          <ProviderDashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('rider-dashboard-page')).toBeInTheDocument();
      });

      // Sidebar elements
      expect(screen.getByTestId('rider-availability-toggle')).toBeInTheDocument();
      expect(screen.getByText('Fleet Cockpit')).toBeInTheDocument();
      expect(screen.getAllByText('Express Fleet Ibadan').length).toBeGreaterThanOrEqual(1);

      // Filter tabs in main area
      expect(screen.getByTestId('filter-pill-opportunities')).toBeInTheDocument();
      expect(screen.getByTestId('filter-pill-active')).toBeInTheDocument();
      expect(screen.getByTestId('filter-pill-completed')).toBeInTheDocument();
    });
  });
});
