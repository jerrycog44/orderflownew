import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CreateDeliveryPage } from '../CreateDeliveryPage';
import { CustomerTrackingPage } from '../CustomerTrackingPage';
import { deliveryService } from '../../services/deliveryService';
import { logisticsService } from '../../services/logisticsService';
import type { DeliveryRecord, LogisticsProvider, PublicTrackingInfo, User } from '../../types';

// Mock AuthContext
const mockVendorUser: User = {
  id: 'vendor-usr-999',
  fullName: 'Amaka Fashion Hub',
  email: 'amaka@hub.ng',
  phone: '+2348011223344',
  role: 'vendor',
  onboardingCompleted: true,
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-20T10:00:00Z',
};

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockVendorUser,
    role: 'vendor',
    isAuthenticated: true,
    isLoading: false,
    hasCompletedOnboarding: true,
    signOut: vi.fn(),
    setRole: vi.fn(),
  }),
  useOptionalAuth: () => ({
    user: mockVendorUser,
    role: 'vendor',
    isAuthenticated: true,
    isLoading: false,
    hasCompletedOnboarding: true,
    signOut: vi.fn(),
    setRole: vi.fn(),
  }),
}));

// Mock Providers
const mockRecommendedProviders: LogisticsProvider[] = [
  {
    id: 'prov-swifthaul',
    name: 'SwiftHaul Express Logistics',
    availability: 'available',
    serviceAreas: ['Ibadan', 'Lagos'],
    estimatedPrice: 3200,
    currency: 'NGN',
    estimatedDeliveryTime: 'Today by 4:00 PM',
    vehicleTypes: ['Motorcycle', 'Van'],
    supportedPackageTypes: ['parcel', 'box'],
    rating: 4.9,
    reviewCount: 128,
    capacity: 'High',
    recommendationTag: 'Best match for package',
    recommendationReason: 'Immediate driver availability in Bodija',
  },
];

// Mock Created Delivery
const mockCreatedDeliveryRecord: DeliveryRecord = {
  id: 'del-new-12345',
  trackingCode: 'OF-849201',
  vendorId: 'vendor-usr-999',
  vendorName: 'Amaka Fashion Hub',
  productName: 'Aso-Oke Wedding Cap',
  package: {
    productName: 'Aso-Oke Wedding Cap',
    itemCategory: 'Fashion & Apparel',
    packageType: 'box',
    quantity: 1,
    weightKg: 1.2,
    dimensionsCm: { length: 25, width: 20, height: 10 },
    fragile: false,
  },
  pickup: { address: '12 Bodija Market Road', city: 'Ibadan' },
  destination: { address: '45 Ring Road', city: 'Ibadan' },
  recipient: { name: 'Dr. Kunle Adeleke', phone: '08033334444' },
  status: 'opportunity_sent',
  dispatchMode: 'auto',
  estimatedPrice: 3200,
  estimatedDeliveryTime: 'Today by 4:00 PM',
  paymentMethod: 'cash_on_delivery',
  paymentStatus: 'pending',
  podVerificationCode: '4921',
  requirePhotoProof: true,
  createdAt: '2026-10-25T01:00:00Z',
  updatedAt: '2026-10-25T01:00:00Z',
};

// Mock Public Tracking Info
const mockPublicTracking: PublicTrackingInfo = {
  trackingCode: 'OF-849201',
  vendorName: 'Amaka Fashion Hub',
  providerName: 'SwiftHaul Express Logistics',
  providerLogoUrl: null,
  productName: 'Aso-Oke Wedding Cap',
  status: 'in_transit',
  estimatedDeliveryTime: 'Today by 4:00 PM',
  paymentMethod: 'cash_on_delivery',
  amountDue: 3200,
  podVerificationCode: '4921',
  requirePhotoProof: true,
  createdAt: '2026-10-25T01:00:00Z',
  updatedAt: '2026-10-25T01:15:00Z',
};

describe('Core Delivery Creation, Provider Selection & Tracking (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(logisticsService, 'getVendorProfile').mockResolvedValue({
      userId: 'vendor-usr-999',
      businessName: 'Amaka Fashion Hub',
      businessCategory: 'Fashion & Apparel',
      operatingCity: 'Ibadan',
      createdAt: '2026-10-20T10:00:00Z',
    });

    vi.spyOn(logisticsService, 'recommendLogisticsProviders').mockReturnValue(mockRecommendedProviders);
    vi.spyOn(logisticsService, 'getRecommendedProviders').mockResolvedValue(mockRecommendedProviders);

    vi.spyOn(deliveryService, 'createDelivery').mockResolvedValue(mockCreatedDeliveryRecord);
    vi.spyOn(deliveryService, 'getPublicTracking').mockResolvedValue(mockPublicTracking);
    vi.spyOn(deliveryService, 'subscribeToDelivery').mockReturnValue(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders step 1 with empty initial values and validates required package fields', async () => {
    render(
      <MemoryRouter>
        <CreateDeliveryPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('create-delivery-page')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-header-title')).toHaveTextContent('Create Delivery');
    expect(screen.getByTestId('mobile-header-subtitle')).toHaveTextContent(/Step 1 of 4/);

    // Attempt advancing without entering product name
    const submitBtn = screen.getByRole('button', { name: /continue to pickup & delivery/i });
    fireEvent.click(submitBtn);

    // Validation error should appear
    await waitFor(() => {
      expect(screen.getByText('Product name is required.')).toBeInTheDocument();
    });
  });

  it('preserves form data across navigation steps (Step 1 -> Step 2 -> Step 3 -> Back)', async () => {
    render(
      <MemoryRouter>
        <CreateDeliveryPage />
      </MemoryRouter>
    );

    // Fill Step 1
    const productNameInput = screen.getByLabelText(/product name/i);
    fireEvent.change(productNameInput, { target: { value: 'Aso-Oke Wedding Cap' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to pickup & delivery/i }));

    // Now on Step 2
    await waitFor(() => {
      expect(screen.getByText(/Step 2: Pickup & Delivery Locations/i)).toBeInTheDocument();
    });

    // Fill Step 2
    const pickupInput = screen.getByLabelText(/pickup address/i);
    fireEvent.change(pickupInput, { target: { value: '12 Bodija Market Road' } });

    const destInput = screen.getByLabelText(/destination address/i);
    fireEvent.change(destInput, { target: { value: '45 Ring Road' } });

    const recipientNameInput = screen.getByLabelText(/recipient full name/i);
    fireEvent.change(recipientNameInput, { target: { value: 'Dr. Kunle Adeleke' } });

    const recipientPhoneInput = screen.getByLabelText(/recipient phone number/i);
    fireEvent.change(recipientPhoneInput, { target: { value: '08033334444' } });

    fireEvent.click(screen.getByRole('button', { name: /review delivery request/i }));

    // Now on Step 3 (Review)
    await waitFor(() => {
      expect(screen.getByText(/Step 3: Review Delivery Request/i)).toBeInTheDocument();
      expect(screen.getByText('Aso-Oke Wedding Cap')).toBeInTheDocument();
      expect(screen.getByText('12 Bodija Market Road')).toBeInTheDocument();
      expect(screen.getByText(/45 Ring Road/i)).toBeInTheDocument();
      expect(screen.getByText('Dr. Kunle Adeleke')).toBeInTheDocument();
    });

    // Navigate back to Step 2 using "Edit Locations" button
    fireEvent.click(screen.getByRole('button', { name: /edit locations/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/pickup address/i)).toHaveValue('12 Bodija Market Road');
      expect(screen.getByLabelText(/destination address/i)).toHaveValue('45 Ring Road');
      expect(screen.getByLabelText(/recipient full name/i)).toHaveValue('Dr. Kunle Adeleke');
      expect(screen.getByLabelText(/recipient phone number/i)).toHaveValue('08033334444');
    });

    // Navigate back to Step 1
    fireEvent.click(screen.getByRole('button', { name: /back to package/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/product name/i)).toHaveValue('Aso-Oke Wedding Cap');
    });
  });

  it('advances through Smart Dispatch and creates delivery with duplicate submission protection', async () => {
    render(
      <MemoryRouter>
        <CreateDeliveryPage />
      </MemoryRouter>
    );

    // Step 1
    fireEvent.change(screen.getByLabelText(/product name/i), { target: { value: 'Aso-Oke Wedding Cap' } });
    fireEvent.click(screen.getByRole('button', { name: /continue to pickup & delivery/i }));

    // Step 2
    await waitFor(() => {
      expect(screen.getByText(/Step 2: Pickup & Delivery Locations/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/pickup address/i), { target: { value: '12 Bodija Market Road' } });
    fireEvent.change(screen.getByLabelText(/destination address/i), { target: { value: '45 Ring Road' } });
    fireEvent.change(screen.getByLabelText(/recipient full name/i), { target: { value: 'Dr. Kunle Adeleke' } });
    fireEvent.change(screen.getByLabelText(/recipient phone number/i), { target: { value: '08033334444' } });
    fireEvent.click(screen.getByRole('button', { name: /review delivery request/i }));

    // Step 3 (Review)
    await waitFor(() => {
      expect(screen.getByText(/Step 3: Review Delivery Request/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /find logistics providers/i }));

    // Step 4 (OrderFlow Smart Dispatch)
    await waitFor(() => {
      expect(screen.getByText(/OrderFlow Smart Dispatch/i)).toBeInTheDocument();
      expect(screen.getByText(/Final Delivery Confirmation & Dispatch/i)).toBeInTheDocument();
      // Should display genuine calculated dynamic price
      expect(screen.getByText('₦3,200')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /confirm delivery/i });

    // Click confirm delivery twice in rapid succession to verify duplicate submission prevention
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    // deliveryService.createDelivery should be called EXACTLY ONCE
    expect(deliveryService.createDelivery).toHaveBeenCalledTimes(1);

    // Check payload passed
    expect(deliveryService.createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        vendorId: 'vendor-usr-999',
        productName: 'Aso-Oke Wedding Cap',
        pickup: expect.objectContaining({ address: '12 Bodija Market Road', city: 'Ibadan' }),
        destination: expect.objectContaining({ address: '45 Ring Road', city: 'Ibadan' }),
        recipient: expect.objectContaining({ name: 'Dr. Kunle Adeleke', phone: '08033334444' }),
        estimatedPrice: 3200,
        paymentMethod: 'cash_on_delivery',
      })
    );

    // Successful creation screen
    await waitFor(() => {
      expect(screen.getByText(/Delivery Request Created/i)).toBeInTheDocument();
      expect(screen.getByText('OF-849201')).toBeInTheDocument();
      expect(screen.getByText('4921')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /share tracking & pin on whatsapp/i })).toBeInTheDocument();
    });
  });

  it('renders CustomerTrackingPage with mobile header, active milestone, COD amount, and handover PIN', async () => {
    render(
      <MemoryRouter initialEntries={['/track/OF-849201']}>
        <Routes>
          <Route path="/track/:trackingCode" element={<CustomerTrackingPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('customer-tracking-page')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mobile-header-title')).toHaveTextContent('OF-849201');
    expect(screen.getByTestId('mobile-header-subtitle')).toHaveTextContent('Aso-Oke Wedding Cap');

    // Check milestone status
    expect(screen.getAllByText(/in transit/i).length).toBeGreaterThan(0);

    // Check COD notice with amount due
    expect(screen.getByText(/payment on delivery required/i)).toBeInTheDocument();
    expect(screen.getByText('₦3,200')).toBeInTheDocument();

    // Check Handover Verification PIN
    expect(screen.getByText(/your handover verification pin/i)).toBeInTheDocument();
    expect(screen.getByText('4921')).toBeInTheDocument();

    // Check verified provider info
    expect(screen.getByText('SwiftHaul Express Logistics')).toBeInTheDocument();
  });

  it('handles tracking search for an unknown code gracefully', async () => {
    vi.spyOn(deliveryService, 'getPublicTracking').mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/track/UNKNOWN-999']}>
        <Routes>
          <Route path="/track/:trackingCode" element={<CustomerTrackingPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Tracking Code Not Found/i)).toBeInTheDocument();
    });
  });
});
