import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConfirmationStep } from '../../components/delivery/ConfirmationStep';
import { CustomerTrackingPage } from '../CustomerTrackingPage';
import { VendorDeliveryDetailPage } from '../VendorDeliveryDetailPage';
import { ProviderDashboardPage } from '../ProviderDashboardPage';
import { deliveryService } from '../../services/deliveryService';
import { logisticsService } from '../../services/logisticsService';
import type {
  DeliveryRecord,
  LocationPoint,
  LogisticsProvider,
  LogisticsProviderProfile,
  PackageDetails,
  PublicTrackingInfo,
  User,
} from '../../types';

const mockUser: User = {
  id: 'user-phase1-001',
  fullName: 'Test Operator',
  email: 'operator@orderflow.ng',
  phone: '+2348011223344',
  role: 'vendor',
  onboardingCompleted: true,
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-20T10:00:00Z',
};

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    role: 'vendor',
    isAuthenticated: true,
    isLoading: false,
    hasCompletedOnboarding: true,
    signOut: vi.fn(),
    setRole: vi.fn(),
  }),
  useOptionalAuth: () => ({
    user: mockUser,
    role: 'vendor',
    isAuthenticated: true,
    isLoading: false,
    hasCompletedOnboarding: true,
    signOut: vi.fn(),
    setRole: vi.fn(),
  }),
}));

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

const VALID_TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

const samplePackage: PackageDetails = {
  productName: 'Solar Inverter Unit',
  itemCategory: 'Electronics',
  packageType: 'box',
  quantity: 1,
  weightKg: 4.5,
  dimensionsCm: { length: 30, width: 25, height: 20 },
  fragile: true,
};

const samplePickup: LocationPoint = { address: '12 Bodija Market Road', city: 'Ibadan' };
const sampleDestination: LocationPoint = { address: '45 Ring Road', city: 'Ibadan' };
const sampleRecipient = { name: 'Dr. Kunle Adeleke', phone: '+2348033334444' };

const sampleProvider: LogisticsProvider = {
  id: 'prov-swifthaul',
  name: 'SwiftHaul Express',
  availability: 'available',
  serviceAreas: ['Ibadan'],
  estimatedPrice: 3500,
  currency: 'NGN',
  estimatedDeliveryTime: 'Today by 5:00 PM',
  vehicleTypes: ['Motorcycle'],
  supportedPackageTypes: ['box'],
  rating: 4.9,
  reviewCount: 42,
  capacity: 'High',
  recommendationTag: 'Fastest nearby',
  recommendationReason: 'Available in Bodija',
};

describe('Phase 1 Frontend Security & Data-Integrity Hardening', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/');

    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    vi.spyOn(deliveryService, 'subscribeToDelivery').mockReturnValue(() => {});
    vi.spyOn(deliveryService, 'subscribeToProviderDispatches').mockReturnValue(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('ConfirmationStep disables prepaid_online, enforces pending paymentStatus, and copies channel-agnostic public + recipient links', async () => {
    const createdDelivery: DeliveryRecord = {
      id: 'del-sec-01',
      trackingCode: 'OF-849201',
      vendorId: 'user-phase1-001',
      vendorName: 'Test Store',
      productName: 'Solar Inverter Unit',
      package: samplePackage,
      pickup: samplePickup,
      destination: sampleDestination,
      recipient: sampleRecipient,
      status: 'opportunity_sent',
      dispatchMode: 'auto',
      estimatedPrice: 3500,
      estimatedDeliveryTime: 'Today by 5:00 PM',
      paymentMethod: 'cash_on_delivery',
      paymentStatus: 'pending',
      podVerificationCode: '4829',
      recipientTrackingToken: VALID_TOKEN,
      requirePhotoProof: false,
      createdAt: '2026-10-25T10:00:00Z',
      updatedAt: '2026-10-25T10:00:00Z',
    };

    vi.spyOn(logisticsService, 'getVendorProfile').mockResolvedValue({
      userId: 'user-phase1-001',
      businessName: 'Test Store',
      businessCategory: 'Electronics',
      operatingCity: 'Ibadan',
      createdAt: '2026-10-20T10:00:00Z',
    });
    vi.spyOn(logisticsService, 'recommendLogisticsProviders').mockReturnValue([sampleProvider]);
    vi.spyOn(logisticsService, 'getRecommendedProviders').mockResolvedValue([sampleProvider]);
    const createSpy = vi
      .spyOn(deliveryService, 'createDelivery')
      .mockResolvedValue(createdDelivery);

    render(
      <MemoryRouter>
        <ConfirmationStep
          packageData={samplePackage}
          pickup={samplePickup}
          destination={sampleDestination}
          recipient={sampleRecipient}
          selectedProvider={sampleProvider}
          dispatchMode="auto"
          onBack={vi.fn()}
        />
      </MemoryRouter>
    );

    const prepaidCard = screen.getByTestId('payment-option-prepaid-online');
    expect(prepaidCard).toHaveAttribute('aria-disabled', 'true');
    expect(prepaidCard).toHaveTextContent(/UNAVAILABLE/i);

    // Clicking disabled Prepaid Online must NOT switch away from Cash on Delivery
    fireEvent.click(prepaidCard);
    fireEvent.click(screen.getByRole('button', { name: /confirm delivery/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethod: 'cash_on_delivery',
        paymentStatus: 'pending',
      })
    );

    // Post-creation confirmation screen renders channel-agnostic copy buttons
    await waitFor(() => {
      expect(screen.getByTestId('copy-public-tracking-link-btn')).toBeInTheDocument();
      expect(screen.getByTestId('copy-recipient-tracking-link-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('copy-public-tracking-link-btn'));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenLastCalledWith(
        expect.stringMatching(/\/track\/OF-849201$/)
      );
    });

    fireEvent.click(screen.getByTestId('copy-recipient-tracking-link-btn'));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenLastCalledWith(
        expect.stringContaining(`/track/OF-849201#pin_token=${VALID_TOKEN}`)
      );
    });
  });

  it('CustomerTrackingPage immediately scrubs #pin_token from URL bar, persists token in sessionStorage, and copies clean URL on Share Link', async () => {
    window.history.replaceState(null, '', `/track/OF-849201#pin_token=${VALID_TOKEN}`);
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    const caseBTracking: PublicTrackingInfo = {
      trackingCode: 'OF-849201',
      vendorName: 'Test Store',
      providerName: 'SwiftHaul Express',
      providerLogoUrl: null,
      productName: 'Solar Inverter Unit',
      status: 'in_transit',
      estimatedDeliveryTime: 'Today by 5:00 PM',
      paymentMethod: 'cash_on_delivery',
      paymentStatus: 'pending',
      amountDue: 3500,
      podVerificationCode: '4829',
      requirePhotoProof: false,
      podPhotoUrl: null,
      createdAt: '2026-10-25T10:00:00Z',
      updatedAt: '2026-10-25T10:15:00Z',
    };

    const getTrackingSpy = vi
      .spyOn(deliveryService, 'getPublicTracking')
      .mockResolvedValue(caseBTracking);

    render(
      <MemoryRouter initialEntries={[`/track/OF-849201#pin_token=${VALID_TOKEN}`]}>
        <Routes>
          <Route path="/track/:trackingCode" element={<CustomerTrackingPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('customer-tracking-page')).toBeInTheDocument();
    });

    // 1. Immediate fragment scrub via replaceState
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/track/OF-849201');
    expect(window.location.hash).toBe('');

    // 2. Stored in sessionStorage & passed to RPC
    expect(window.sessionStorage.getItem('of_pin_tok:OF-849201')).toBe(VALID_TOKEN);
    expect(getTrackingSpy).toHaveBeenCalledWith('OF-849201', VALID_TOKEN);

    // 3. Case B displays PIN and COD amount
    expect(screen.getByText('4829')).toBeInTheDocument();
    expect(screen.getByText('₦3,500')).toBeInTheDocument();

    // 4. Share Link copies clean public URL WITHOUT #pin_token
    fireEvent.click(screen.getByRole('button', { name: /share link/i }));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/track\/OF-849201$/)
      );
      expect(writeTextMock.mock.calls[0][0]).not.toContain('pin_token');
    });
  });

  it('CustomerTrackingPage hides PIN, COD amount, and POD photo on Case A / Case C tracking responses', async () => {
    const caseATracking: PublicTrackingInfo = {
      trackingCode: 'OF-849201',
      vendorName: 'Test Store',
      providerName: 'SwiftHaul Express',
      providerLogoUrl: null,
      productName: 'Solar Inverter Unit',
      status: 'in_transit',
      estimatedDeliveryTime: 'Today by 5:00 PM',
      paymentMethod: null,
      paymentStatus: null,
      amountDue: null,
      podVerificationCode: null,
      requirePhotoProof: false,
      podPhotoUrl: null,
      createdAt: '2026-10-25T10:00:00Z',
      updatedAt: '2026-10-25T10:15:00Z',
    };

    const getTrackingSpy = vi
      .spyOn(deliveryService, 'getPublicTracking')
      .mockResolvedValue(caseATracking);

    render(
      <MemoryRouter initialEntries={['/track/OF-849201']}>
        <Routes>
          <Route path="/track/:trackingCode" element={<CustomerTrackingPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('protected-pin-notice')).toBeInTheDocument();
    });

    expect(getTrackingSpy).toHaveBeenCalledWith('OF-849201');
    expect(screen.queryByText(/your handover verification pin/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/payment on delivery required/i)).not.toBeInTheDocument();
  });

  it('VendorDeliveryDetailPage renders legacy orders honestly, opens inline POD photo modal without window.open, and supports PIN rotation', async () => {
    const legacyDelivered: DeliveryRecord = {
      id: 'del-legacy-99',
      trackingCode: 'OF-LEG999',
      vendorId: 'user-phase1-001',
      vendorName: 'Test Store',
      productName: 'Legacy Textile Bundle',
      package: samplePackage,
      pickup: samplePickup,
      destination: sampleDestination,
      recipient: sampleRecipient,
      status: 'in_transit',
      dispatchMode: 'auto',
      estimatedPrice: 2800,
      estimatedDeliveryTime: 'Yesterday',
      paymentMethod: undefined,
      paymentStatus: undefined,
      podVerificationCode: '7361',
      recipientTrackingToken: VALID_TOKEN,
      podFailedAttempts: 5,
      requirePhotoProof: true,
      podPhotoUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-01T12:00:00Z',
    };

    vi.spyOn(deliveryService, 'getDeliveryById').mockResolvedValue(legacyDelivered);
    const rotateSpy = vi.spyOn(deliveryService, 'rotateDeliveryPodSecrets').mockResolvedValue({
      success: true,
      podVerificationCode: '9182',
      recipientTrackingToken: 'b'.repeat(64),
      tokenExpiresAt: '2026-11-08T00:00:00Z',
    });
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <MemoryRouter initialEntries={['/vendor/deliveries/del-legacy-99']}>
        <Routes>
          <Route path="/vendor/deliveries/:id" element={<VendorDeliveryDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('legacy-payment-notice')).toBeInTheDocument();
    });

    expect(screen.getByText(/Not Recorded \(Legacy Order\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Prepaid Online/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pending Collection/i)).not.toBeInTheDocument();

    // 5-attempt lockout warning is displayed
    expect(screen.getByTestId('pod-lockout-alert')).toBeInTheDocument();

    // Clicking POD photo thumbnail opens inline lightbox modal instead of window.open
    fireEvent.click(screen.getByTestId('vendor-pod-photo-thumbnail'));
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('pod-photo-lightbox')).toBeInTheDocument();

    // Rotate PIN button calls rotateDeliveryPodSecrets
    fireEvent.click(screen.getByTestId('rotate-pod-secrets-btn'));
    await waitFor(() => {
      expect(rotateSpy).toHaveBeenCalledWith('del-legacy-99');
    });
  });

  it('ProviderDashboardPage displays Settlement: Confirm with Vendor for legacy orders without recorded paymentMethod', async () => {
    const providerProfile: LogisticsProviderProfile = {
      userId: 'user-phase1-001',
      providerName: 'SwiftHaul Express',
      providerType: 'courier',
      coverageArea: 'Ibadan',
      vehicleTypes: ['motorcycle'],
      packageCategories: ['box'],
      availability: 'available',
      createdAt: '2026-10-20T10:00:00Z',
    };

    const legacyActiveJob: DeliveryRecord = {
      id: 'del-legacy-active',
      trackingCode: 'OF-LEG101',
      vendorId: 'vendor-01',
      vendorName: 'Legacy Vendor',
      productName: 'Legacy Parcel',
      package: samplePackage,
      pickup: samplePickup,
      destination: sampleDestination,
      recipient: sampleRecipient,
      status: 'in_transit',
      providerId: 'user-phase1-001',
      dispatchMode: 'auto',
      estimatedPrice: 2500,
      estimatedDeliveryTime: 'Today',
      paymentMethod: undefined,
      paymentStatus: undefined,
      requirePhotoProof: false,
      createdAt: '2026-09-10T10:00:00Z',
      updatedAt: '2026-09-10T11:00:00Z',
    };

    vi.spyOn(logisticsService, 'getProviderProfile').mockResolvedValue(providerProfile);
    vi.spyOn(deliveryService, 'getProviderTargetedOpportunity').mockResolvedValue(null);
    vi.spyOn(deliveryService, 'getProviderOpportunities').mockResolvedValue([]);
    vi.spyOn(deliveryService, 'getProviderAssignedDeliveries').mockResolvedValue([legacyActiveJob]);

    render(
      <MemoryRouter>
        <ProviderDashboardPage />
      </MemoryRouter>
    );

    // Switch to Active tab
    const activeTabBtn = await screen.findByTestId('filter-pill-active');
    fireEvent.click(activeTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Settlement: Confirm with Vendor/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Prepaid Online/i)).not.toBeInTheDocument();
  });
});
