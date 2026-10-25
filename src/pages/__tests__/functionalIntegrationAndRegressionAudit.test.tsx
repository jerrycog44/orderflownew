import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from '../../components/auth/ProtectedRoute';
import { ConfirmationStep } from '../../components/delivery/ConfirmationStep';
import { ProviderDashboardPage } from '../ProviderDashboardPage';
import { deliveryService } from '../../services/deliveryService';
import { logisticsService } from '../../services/logisticsService';
import { realtimeService, REALTIME_EVENTS } from '../../services/realtimeService';
import type { DeliveryRecord, PackageDetails, LocationPoint, User } from '../../types';

// Mock contexts
let mockAuthState = {
  user: null as User | null,
  isLoading: false,
  isAuthenticated: false,
  role: null as any,
  hasCompletedOnboarding: false,
  signOut: vi.fn(),
  setRole: vi.fn(),
  login: vi.fn(),
  signUp: vi.fn(),
  forgotPassword: vi.fn(),
  completeVendorOnboarding: vi.fn(),
  completeProviderOnboarding: vi.fn(),
};

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => mockAuthState,
  useOptionalAuth: () => mockAuthState,
}));

const mockAddToast = vi.fn();
vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

describe('Phase 7: Functional Integration & Regression Audit', () => {
  const originalLocalStorage = window.localStorage;
  let testStore: Record<string, string> = {};

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    testStore = {};

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => testStore[k] || null,
        setItem: (k: string, v: string) => { testStore[k] = v; },
        removeItem: (k: string) => { delete testStore[k]; },
        clear: () => { testStore = {}; },
      },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
  });

  // -------------------------------------------------------------------------
  // 1. AUTHENTICATION, SESSION RESTORATION & ROUTE GUARDS
  // -------------------------------------------------------------------------
  describe('1. Authentication & Route Protection Audit', () => {
    it('renders a spinner during initial session recovery (prevents route flash)', () => {
      mockAuthState = {
        ...mockAuthState,
        isLoading: true,
        isAuthenticated: false,
        user: null,
      };

      const { container } = render(
        <MemoryRouter initialEntries={['/vendor/dashboard']}>
          <Routes>
            <Route
              path="/vendor/dashboard"
              element={
                <ProtectedRoute requiredRole="vendor">
                  <div>Vendor Dashboard Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.queryByText('Vendor Dashboard Content')).not.toBeInTheDocument();
      expect(container.querySelector('.animate-spin, svg')).toBeTruthy();
    });

    it('redirects unauthenticated users to /login preserving destination state', () => {
      mockAuthState = {
        ...mockAuthState,
        isLoading: false,
        isAuthenticated: false,
        user: null,
      };

      render(
        <MemoryRouter initialEntries={['/vendor/dashboard']}>
          <Routes>
            <Route
              path="/vendor/dashboard"
              element={
                <ProtectedRoute requiredRole="vendor">
                  <div>Vendor Dashboard Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page Screen</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Login Page Screen')).toBeInTheDocument();
      expect(screen.queryByText('Vendor Dashboard Content')).not.toBeInTheDocument();
    });

    it('redirects authenticated user without role to /role-selection', () => {
      mockAuthState = {
        ...mockAuthState,
        isLoading: false,
        isAuthenticated: true,
        user: {
          id: 'user-no-role',
          fullName: 'New User',
          email: 'new@orderflow.ng',
          phone: null,
          role: null,
          onboardingCompleted: false,
          createdAt: '2026-10-25T00:00:00Z',
          updatedAt: '2026-10-25T00:00:00Z',
        },
        role: null,
        hasCompletedOnboarding: false,
      };

      render(
        <MemoryRouter initialEntries={['/vendor/dashboard']}>
          <Routes>
            <Route
              path="/vendor/dashboard"
              element={
                <ProtectedRoute requiredRole="vendor">
                  <div>Vendor Dashboard Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/role-selection" element={<div>Role Selection Screen</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Role Selection Screen')).toBeInTheDocument();
    });

    it('redirects authenticated user with incomplete onboarding to respective onboarding page', () => {
      mockAuthState = {
        ...mockAuthState,
        isLoading: false,
        isAuthenticated: true,
        user: {
          id: 'vendor-pending',
          fullName: 'Incomplete Vendor',
          email: 'pending@vendor.ng',
          phone: '+2348012345678',
          role: 'vendor',
          onboardingCompleted: false,
          createdAt: '2026-10-25T00:00:00Z',
          updatedAt: '2026-10-25T00:00:00Z',
        },
        role: 'vendor',
        hasCompletedOnboarding: false,
      };

      render(
        <MemoryRouter initialEntries={['/vendor/dashboard']}>
          <Routes>
            <Route
              path="/vendor/dashboard"
              element={
                <ProtectedRoute requiredRole="vendor">
                  <div>Vendor Dashboard Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/onboarding/vendor" element={<div>Vendor Onboarding Flow</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Vendor Onboarding Flow')).toBeInTheDocument();
    });

    it('enforces role boundaries: redirects merchant trying to access provider workspace to vendor dashboard', () => {
      mockAuthState = {
        ...mockAuthState,
        isLoading: false,
        isAuthenticated: true,
        user: {
          id: 'merchant-user',
          fullName: 'Zainab Merchant',
          email: 'zainab@store.ng',
          phone: '+2348011223344',
          role: 'vendor',
          onboardingCompleted: true,
          createdAt: '2026-10-25T00:00:00Z',
          updatedAt: '2026-10-25T00:00:00Z',
        },
        role: 'vendor',
        hasCompletedOnboarding: true,
      };

      render(
        <MemoryRouter initialEntries={['/logistics/dashboard']}>
          <Routes>
            <Route
              path="/logistics/dashboard"
              element={
                <ProtectedRoute requiredRole="logistics_provider">
                  <div>Courier Workspace</div>
                </ProtectedRoute>
              }
            />
            <Route path="/vendor/dashboard" element={<div>Vendor Dashboard Safe Area</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Vendor Dashboard Safe Area')).toBeInTheDocument();
      expect(screen.queryByText('Courier Workspace')).not.toBeInTheDocument();
    });

    it('PublicOnlyRoute redirects logged in user away from /login directly to dashboard', () => {
      mockAuthState = {
        ...mockAuthState,
        isLoading: false,
        isAuthenticated: true,
        user: {
          id: 'logged-in-courier',
          fullName: 'Courier Rider',
          email: 'rider@swift.ng',
          phone: '+2348099887766',
          role: 'logistics_provider',
          onboardingCompleted: true,
          createdAt: '2026-10-25T00:00:00Z',
          updatedAt: '2026-10-25T00:00:00Z',
        },
        role: 'logistics_provider',
        hasCompletedOnboarding: true,
      };

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <div>Public Login Screen</div>
                </PublicOnlyRoute>
              }
            />
            <Route path="/logistics/dashboard" element={<div>Courier Live Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Courier Live Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Public Login Screen')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 2. DELIVERY CREATION & DUPLICATE SUBMISSION PREVENTION
  // -------------------------------------------------------------------------
  describe('2. Delivery Creation & Duplicate Submission Guard', () => {
    const samplePackage: PackageDetails = {
      productName: 'Organic Shea Butter (500g)',
      itemCategory: 'Cosmetics',
      packageType: 'parcel',
      quantity: 2,
      weightKg: 1.5,
      dimensionsCm: { length: 20, width: 15, height: 10 },
      fragile: true,
    };

    const samplePickup: LocationPoint = {
      address: 'Shop 14, Bodija Market',
      city: 'Ibadan',
      contactName: 'Zainab Balogun',
      contactPhone: '+2348011223344',
    };

    const sampleDestination: LocationPoint = {
      address: 'Block B, Ring Road Commercial Complex',
      city: 'Ibadan',
    };

    const sampleRecipient = {
      name: 'Fadekemi Adeleke',
      phone: '+2348099887766',
    };

    it('prevents duplicate submissions when user clicks rapidly or repeatedly', async () => {
      mockAuthState = {
        ...mockAuthState,
        isLoading: false,
        isAuthenticated: true,
        user: {
          id: 'vendor-123',
          fullName: 'Zainab Stores',
          email: 'zainab@stores.ng',
          phone: '+2348011223344',
          role: 'vendor',
          onboardingCompleted: true,
          createdAt: '2026-10-20T00:00:00Z',
          updatedAt: '2026-10-20T00:00:00Z',
        },
        role: 'vendor',
        hasCompletedOnboarding: true,
      };

      const createSpy = vi.spyOn(deliveryService, 'createDelivery').mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          id: 'del-mock-999',
          trackingCode: 'OF-999111',
          vendorId: 'vendor-123',
          vendorName: 'Zainab Stores',
          productName: samplePackage.productName,
          package: samplePackage,
          pickup: samplePickup,
          destination: sampleDestination,
          recipient: sampleRecipient,
          status: 'opportunity_sent',
          dispatchMode: 'auto',
          estimatedPrice: 2800,
          estimatedDeliveryTime: 'Same Day',
          paymentMethod: 'cash_on_delivery',
          paymentStatus: 'pending',
          createdAt: '2026-10-25T01:00:00Z',
          updatedAt: '2026-10-25T01:00:00Z',
        }), 100))
      );

      render(
        <MemoryRouter>
          <ConfirmationStep
            packageData={samplePackage}
            pickup={samplePickup}
            destination={sampleDestination}
            recipient={sampleRecipient}
            dispatchMode="auto"
            onBack={vi.fn()}
          />
        </MemoryRouter>
      );

      const submitBtn = screen.getByRole('button', { name: /confirm delivery/i });
      expect(submitBtn).toBeInTheDocument();

      // Trigger rapid consecutive clicks
      fireEvent.click(submitBtn);
      fireEvent.click(submitBtn);
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/delivery request created/i)).toBeInTheDocument();
      });

      // The synchronous ref lock inside ConfirmationStep guarantees exactly ONE call
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 3. RIDER AVAILABILITY & DISPATCH SUPPRESSION
  // -------------------------------------------------------------------------
  describe('3. Rider Availability State & Targeted Dispatch Suppression', () => {
    it('suppresses targeted dispatch cards and renders warning banner when rider toggles to Offline', async () => {
      const sampleProvider: User = {
        id: 'rider-007',
        fullName: 'Babatunde Swift',
        email: 'tunde@swift.ng',
        phone: '+2348099887766',
        role: 'logistics_provider',
        onboardingCompleted: true,
        createdAt: '2026-10-20T00:00:00Z',
        updatedAt: '2026-10-20T00:00:00Z',
      };

      mockAuthState = {
        ...mockAuthState,
        user: sampleProvider,
        role: 'logistics_provider',
        isAuthenticated: true,
        hasCompletedOnboarding: true,
      };

      vi.spyOn(logisticsService, 'getProviderProfile').mockResolvedValue({
        userId: 'rider-007',
        providerName: 'Babatunde Express',
        providerType: 'courier',
        coverageArea: 'Ibadan Metro',
        vehicleTypes: ['motorcycle'],
        packageCategories: ['parcel'],
        availability: 'available',
        createdAt: '2026-10-20T00:00:00Z',
      });

      vi.spyOn(deliveryService, 'getProviderOpportunities').mockResolvedValue([]);
      vi.spyOn(deliveryService, 'getProviderAssignedDeliveries').mockResolvedValue([]);
      vi.spyOn(deliveryService, 'getProviderTargetedOpportunity').mockResolvedValue({
        id: 'del-targeted-99',
        trackingCode: 'OF-TGT-99',
        vendorId: 'vendor-1',
        vendorName: 'Zainab Fabrics',
        productName: 'Silk Gown',
        package: {
          productName: 'Silk Gown',
          itemCategory: 'Apparel',
          packageType: 'parcel',
          quantity: 1,
          weightKg: 0.8,
          dimensionsCm: { length: 25, width: 20, height: 5 },
          fragile: false,
        },
        pickup: { address: '12 Bodija Rd', city: 'Ibadan' },
        destination: { address: '44 Ring Rd', city: 'Ibadan' },
        recipient: { name: 'Customer', phone: '+2348000000000' },
        status: 'opportunity_sent',
        dispatchMode: 'auto',
        estimatedPrice: 3200,
        estimatedDeliveryTime: 'Within 2 hours',
        createdAt: '2026-10-25T01:00:00Z',
        updatedAt: '2026-10-25T01:00:00Z',
      });

      const updateAvailSpy = vi.spyOn(logisticsService, 'updateProviderAvailability').mockResolvedValue(true);

      render(
        <MemoryRouter>
          <ProviderDashboardPage />
        </MemoryRouter>
      );

      // Initially online: targeted opportunity card should be visible
      await waitFor(() => {
        expect(screen.getByTestId('targeted-opportunity-card')).toBeInTheDocument();
      });

      // Click "Offline" button
      const offlineBtn = screen.getByTestId('avail-offline-btn');
      fireEvent.click(offlineBtn);

      // Verify updateProviderAvailability was called
      expect(updateAvailSpy).toHaveBeenCalledWith('rider-007', 'unavailable');

      // Offline banner should now be visible
      expect(screen.getByTestId('rider-offline-banner')).toBeInTheDocument();
      expect(screen.getByText(/You are currently/i)).toBeInTheDocument();

      // Targeted card must be suppressed while offline
      expect(screen.queryByTestId('targeted-opportunity-card')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 4. JOB ACCEPTANCE, DECLINE & DOUBLE-ASSIGNMENT PROTECTION
  // -------------------------------------------------------------------------
  describe('4. Job Acceptance, Decline & Double-Assignment Protection', () => {
    it('accepts an opportunity and transitions status to provider_selected with courier assignment', async () => {
      const mockRecord: DeliveryRecord = {
        id: 'del-job-1',
        trackingCode: 'OF-JOB-01',
        vendorId: 'vendor-01',
        vendorName: 'Merchant Shop',
        productName: 'Phone Case',
        package: {
          productName: 'Phone Case',
          itemCategory: 'Electronics',
          packageType: 'parcel',
          quantity: 1,
          weightKg: 0.2,
          dimensionsCm: { length: 15, width: 10, height: 2 },
          fragile: false,
        },
        pickup: { address: 'Dugbe', city: 'Ibadan' },
        destination: { address: 'Iwo Road', city: 'Ibadan' },
        recipient: { name: 'Ade', phone: '+2348011111111' },
        status: 'opportunity_sent',
        dispatchMode: 'auto',
        estimatedPrice: 2000,
        estimatedDeliveryTime: 'Same Day',
        createdAt: '2026-10-25T01:00:00Z',
        updatedAt: '2026-10-25T01:00:00Z',
      };

      testStore['of_dev_deliveries'] = JSON.stringify([mockRecord]);

      const result = await deliveryService.acceptDelivery('del-job-1', 'rider-007', 'Babatunde Express');
      expect(result).not.toBeNull();
      expect(result?.status).toBe('provider_selected');
      expect(result?.providerId).toBe('rider-007');
      expect(result?.selectedProvider?.name).toBe('Babatunde Express');

      // Double-acceptance protection: another rider attempting to accept the same delivery returns null
      const secondAttempt = await deliveryService.acceptDelivery('del-job-1', 'rider-999', 'Rival Courier');
      expect(secondAttempt).toBeNull();
    });

    it('declines opportunity and advances candidate queue to next eligible provider', async () => {
      const mockRecordWithQueue: DeliveryRecord = {
        id: 'del-queue-1',
        trackingCode: 'OF-QUE-01',
        vendorId: 'vendor-01',
        vendorName: 'Merchant Shop',
        productName: 'Handbag',
        package: {
          productName: 'Handbag',
          itemCategory: 'Fashion',
          packageType: 'parcel',
          quantity: 1,
          weightKg: 1,
          dimensionsCm: { length: 30, width: 25, height: 10 },
          fragile: false,
        },
        pickup: { address: 'Bodija', city: 'Ibadan' },
        destination: { address: 'Ring Road', city: 'Ibadan' },
        recipient: { name: 'Bola', phone: '+2348022222222' },
        status: 'opportunity_sent',
        dispatchMode: 'auto',
        candidateQueue: ['rider-007', 'rider-008', 'rider-009'],
        currentOpportunityProviderId: 'rider-007',
        estimatedPrice: 2500,
        estimatedDeliveryTime: 'Same Day',
        createdAt: '2026-10-25T01:00:00Z',
        updatedAt: '2026-10-25T01:00:00Z',
      };

      testStore['of_dev_deliveries'] = JSON.stringify([mockRecordWithQueue]);

      const declined = await deliveryService.declineOpportunity('del-queue-1', 'rider-007');
      expect(declined).toBe(true);

      const updated = await deliveryService.getDeliveryById('del-queue-1');
      expect(updated?.currentOpportunityProviderId).toBe('rider-008');
      expect(updated?.declinedProviderIds).toContain('rider-007');
      expect(updated?.status).toBe('opportunity_sent');
    });
  });

  // -------------------------------------------------------------------------
  // 5. DELIVERY STATUS TRANSITIONS & REALTIME EVENTS
  // -------------------------------------------------------------------------
  describe('5. Delivery Status State Transitions & Realtime Synchronization', () => {
    it('transitions delivery status from awaiting_pickup to in_transit and fires mutation event', async () => {
      const mockDelivery: DeliveryRecord = {
        id: 'del-status-1',
        trackingCode: 'OF-STA-01',
        vendorId: 'vendor-01',
        vendorName: 'Merchant',
        productName: 'Speakers',
        package: {
          productName: 'Speakers',
          itemCategory: 'Electronics',
          packageType: 'parcel',
          quantity: 1,
          weightKg: 2,
          dimensionsCm: { length: 25, width: 20, height: 15 },
          fragile: true,
        },
        pickup: { address: 'Mokola', city: 'Ibadan' },
        destination: { address: 'Samonda', city: 'Ibadan' },
        recipient: { name: 'Tunde', phone: '+2348033333333' },
        status: 'awaiting_pickup',
        providerId: 'rider-007',
        dispatchMode: 'auto',
        estimatedPrice: 3000,
        estimatedDeliveryTime: 'Same Day',
        createdAt: '2026-10-25T01:00:00Z',
        updatedAt: '2026-10-25T01:00:00Z',
      };

      testStore['of_dev_deliveries'] = JSON.stringify([mockDelivery]);

      const mutationSpy = vi.spyOn(realtimeService, 'notifyMutation');

      const updated = await deliveryService.updateDeliveryStatus('del-status-1', 'in_transit');
      expect(updated?.status).toBe('in_transit');
      expect(mutationSpy).toHaveBeenCalledWith('delivery', expect.objectContaining({ id: 'del-status-1', status: 'in_transit' }));
    });

    it('subscribes to realtime updates and unsubscribes cleanly without memory leaks', () => {
      const callback = vi.fn();
      const unsubscribe = deliveryService.subscribeToDelivery('del-test-sub', callback);

      // Dispatch local event
      window.dispatchEvent(new CustomEvent(REALTIME_EVENTS.DELIVERY_UPDATED, { detail: { id: 'del-test-sub' } }));
      expect(callback).toHaveBeenCalledTimes(1);

      // Clean up unsubscribe
      unsubscribe();

      // Dispatch again
      window.dispatchEvent(new CustomEvent(REALTIME_EVENTS.DELIVERY_UPDATED, { detail: { id: 'del-test-sub' } }));
      // Callback must not fire after unsubscribe
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 6. PROOF OF DELIVERY (POD), PIN VERIFICATION & SETTLEMENT
  // -------------------------------------------------------------------------
  describe('6. Proof of Delivery (POD) Verification & COD Settlement', () => {
    it('rejects incorrect 4-digit recipient verification code', async () => {
      const mockRecord: DeliveryRecord = {
        id: 'del-pod-1',
        trackingCode: 'OF-POD-01',
        vendorId: 'vendor-01',
        vendorName: 'Merchant',
        productName: 'Watch',
        package: {
          productName: 'Watch',
          itemCategory: 'Jewelry',
          packageType: 'parcel',
          quantity: 1,
          weightKg: 0.3,
          dimensionsCm: { length: 10, width: 8, height: 5 },
          fragile: true,
        },
        pickup: { address: 'Dugbe', city: 'Ibadan' },
        destination: { address: 'Challenge', city: 'Ibadan' },
        recipient: { name: 'Customer', phone: '+2348000000000' },
        status: 'in_transit',
        providerId: 'rider-007',
        podVerificationCode: '8492',
        requirePhotoProof: false,
        dispatchMode: 'auto',
        estimatedPrice: 4000,
        estimatedDeliveryTime: 'Same Day',
        createdAt: '2026-10-25T01:00:00Z',
        updatedAt: '2026-10-25T01:00:00Z',
      };

      testStore['of_dev_deliveries'] = JSON.stringify([mockRecord]);

      // Incorrect PIN
      const res = await deliveryService.completeDeliveryWithPod('del-pod-1', '1234');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid 4-digit verification code/i);
    });

    it('requires photo proof if specified by vendor, and marks COD as collected on valid PIN', async () => {
      const mockRecord: DeliveryRecord = {
        id: 'del-pod-2',
        trackingCode: 'OF-POD-02',
        vendorId: 'vendor-01',
        vendorName: 'Merchant',
        productName: 'Smartphone',
        package: {
          productName: 'Smartphone',
          itemCategory: 'Electronics',
          packageType: 'parcel',
          quantity: 1,
          weightKg: 0.5,
          dimensionsCm: { length: 18, width: 10, height: 6 },
          fragile: true,
        },
        pickup: { address: 'Dugbe', city: 'Ibadan' },
        destination: { address: 'Bodija', city: 'Ibadan' },
        recipient: { name: 'Customer', phone: '+2348000000000' },
        status: 'in_transit',
        providerId: 'rider-007',
        paymentMethod: 'cash_on_delivery',
        paymentStatus: 'pending',
        podVerificationCode: '7721',
        requirePhotoProof: true,
        dispatchMode: 'auto',
        estimatedPrice: 5000,
        estimatedDeliveryTime: 'Same Day',
        createdAt: '2026-10-25T01:00:00Z',
        updatedAt: '2026-10-25T01:00:00Z',
      };

      testStore['of_dev_deliveries'] = JSON.stringify([mockRecord]);

      // Valid PIN but missing required photo
      const missingPhotoRes = await deliveryService.completeDeliveryWithPod('del-pod-2', '7721');
      expect(missingPhotoRes.success).toBe(false);
      expect(missingPhotoRes.error).toMatch(/required photo proof/i);

      // Valid PIN + photo supplied
      const validRes = await deliveryService.completeDeliveryWithPod(
        'del-pod-2',
        '7721',
        'data:image/png;base64,mockHandoverPhotoProof'
      );

      expect(validRes.success).toBe(true);
      expect(validRes.delivery?.status).toBe('delivered');
      expect(validRes.delivery?.paymentStatus).toBe('collected'); // COD automatically marked collected
      expect(validRes.delivery?.podPhotoUrl).toContain('mockHandoverPhotoProof');
    });
  });

  // -------------------------------------------------------------------------
  // 7. ERROR HANDLING & RESILIENCE
  // -------------------------------------------------------------------------
  describe('7. Error Handling & System Resilience', () => {
    it('gracefully handles missing delivery without throwing unhandled exception', async () => {
      testStore['of_dev_deliveries'] = JSON.stringify([]);
      const notFound = await deliveryService.getDeliveryById('non-existent-id');
      expect(notFound).toBeNull();
    });

    it('returns null on invalid tracking code for public tracking', async () => {
      const publicInfo = await deliveryService.getPublicTracking('');
      expect(publicInfo).toBeNull();
    });
  });
});
