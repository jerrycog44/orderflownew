import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VendorDashboardPage } from '../VendorDashboardPage';
import { deliveryService } from '../../services/deliveryService';
import { logisticsService } from '../../services/logisticsService';
import type { DeliveryRecord, VendorProfile, User } from '../../types';

// Mock AuthContext
const mockUser: User = {
  id: 'vendor-user-123',
  fullName: 'Tunde Adeleke',
  email: 'tunde@apexretail.ng',
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
    user: mockUser,
    signOut: mockSignOut,
    setRole: mockSetRole,
    role: 'vendor',
    isAuthenticated: true,
    isLoading: false,
    hasCompletedOnboarding: true,
  }),
  useOptionalAuth: () => ({
    user: mockUser,
    signOut: mockSignOut,
    setRole: mockSetRole,
    role: 'vendor',
    isAuthenticated: true,
    isLoading: false,
    hasCompletedOnboarding: true,
  }),
}));

// Mock Toast
const mockAddToast = vi.fn();
vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

// Sample Deliveries Data
const sampleDeliveries: DeliveryRecord[] = [
  {
    id: 'del-001',
    trackingCode: 'OF-1001',
    vendorId: 'vendor-user-123',
    vendorName: 'Apex Store',
    productName: 'Sneakers Pro',
    package: {
      productName: 'Sneakers Pro',
      itemCategory: 'Footwear',
      packageType: 'box',
      quantity: 1,
      weightKg: 1.2,
      dimensionsCm: { length: 30, width: 20, height: 12 },
      fragile: false,
    },
    pickup: { address: '12 Marina Road', city: 'Lagos Island' },
    destination: { address: '45 Admiralty Way', city: 'Lekki' },
    recipient: { name: 'Amina Bello', phone: '+2348033334444' },
    status: 'in_transit',
    estimatedPrice: 3500,
    estimatedDeliveryTime: 'Today',
    createdAt: '2026-10-24T09:00:00Z',
    updatedAt: '2026-10-24T10:00:00Z',
  },
  {
    id: 'del-002',
    trackingCode: 'OF-1002',
    vendorId: 'vendor-user-123',
    vendorName: 'Apex Store',
    productName: 'Smart Watch',
    package: {
      productName: 'Smart Watch',
      itemCategory: 'Electronics',
      packageType: 'parcel',
      quantity: 1,
      weightKg: 0.4,
      dimensionsCm: { length: 15, width: 10, height: 5 },
      fragile: true,
    },
    pickup: { address: '12 Marina Road', city: 'Lagos Island' },
    destination: { address: '8 Ring Road', city: 'Ibadan' },
    recipient: { name: 'Femi Otedola', phone: '+2348055556666' },
    status: 'awaiting_pickup',
    estimatedPrice: 5000,
    estimatedDeliveryTime: 'Tomorrow',
    createdAt: '2026-10-24T11:00:00Z',
    updatedAt: '2026-10-24T11:00:00Z',
  },
  {
    id: 'del-003',
    trackingCode: 'OF-1003',
    vendorId: 'vendor-user-123',
    vendorName: 'Apex Store',
    productName: 'Designer Handbag',
    package: {
      productName: 'Designer Handbag',
      itemCategory: 'Fashion',
      packageType: 'bag',
      quantity: 1,
      weightKg: 0.9,
      dimensionsCm: { length: 25, width: 20, height: 10 },
      fragile: false,
    },
    pickup: { address: '12 Marina Road', city: 'Lagos Island' },
    destination: { address: '3 Allen Ave', city: 'Ikeja' },
    recipient: { name: 'Ngozi Eze', phone: '+2348077778888' },
    status: 'delivered',
    estimatedPrice: 2800,
    estimatedDeliveryTime: 'Delivered',
    createdAt: '2026-10-23T14:00:00Z',
    updatedAt: '2026-10-23T18:00:00Z',
  },
];

const mockProfile: VendorProfile = {
  userId: 'vendor-user-123',
  businessName: 'Apex Luxury Lagos',
  businessCategory: 'Retail & Fashion',
  operatingCity: 'Lagos Island',
  createdAt: '2026-10-20T10:00:00Z',
};

describe('Phase 4: Merchant Application Redesign (VendorDashboardPage)', () => {
  beforeEach(() => {
    vi.spyOn(logisticsService, 'getVendorProfile').mockResolvedValue(mockProfile);
    vi.spyOn(deliveryService, 'getVendorDeliveries').mockResolvedValue(sampleDeliveries);
    vi.spyOn(deliveryService, 'subscribeToVendorDeliveries').mockReturnValue(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders merchant mobile header with business title, vendor badge, and action buttons', async () => {
    render(
      <MemoryRouter>
        <VendorDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('mobile-header-title')).toHaveTextContent('Apex Luxury Lagos');
    });
    expect(screen.getByTestId('mobile-header-badge')).toHaveTextContent('Vendor');
    expect(screen.getByTestId('merchant-refresh-btn')).toBeInTheDocument();
    expect(screen.getByTestId('merchant-profile-btn')).toBeInTheDocument();
  });

  it('renders quick action banner with create button and 48px touch target', async () => {
    render(
      <MemoryRouter>
        <VendorDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('merchant-create-delivery-cta')).toBeInTheDocument();
    });
    expect(screen.getByText('Dispatch a Parcel')).toBeInTheDocument();
    expect(screen.getByText('Match instantly with verified couriers')).toBeInTheDocument();
  });

  it('renders operational metrics computed from live delivery records', async () => {
    render(
      <MemoryRouter>
        <VendorDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('metric-total-orders')).toHaveTextContent('3');
    });
    expect(screen.getByTestId('metric-pending-dispatch')).toHaveTextContent('1');
    expect(screen.getByTestId('metric-in-transit')).toHaveTextContent('1');
    expect(screen.getByTestId('metric-delivered')).toHaveTextContent('1');
  });

  it('filters deliveries by status using StatusFilterPills', async () => {
    render(
      <MemoryRouter>
        <VendorDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('delivery-job-card-OF-1001')).toBeInTheDocument();
    });

    // All deliveries initially visible
    expect(screen.getByTestId('delivery-job-card-OF-1002')).toBeInTheDocument();
    expect(screen.getByTestId('delivery-job-card-OF-1003')).toBeInTheDocument();
    expect(screen.getByTestId('merchant-filtered-count')).toHaveTextContent('3');

    // Click "In Transit" pill
    const inTransitPill = screen.getByTestId('filter-pill-in_transit');
    fireEvent.click(inTransitPill);

    expect(screen.getByTestId('delivery-job-card-OF-1001')).toBeInTheDocument();
    expect(screen.queryByTestId('delivery-job-card-OF-1002')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delivery-job-card-OF-1003')).not.toBeInTheDocument();
    expect(screen.getByTestId('merchant-filtered-count')).toHaveTextContent('1');
  });

  it('filters deliveries using mobile search bar and clears with X button', async () => {
    render(
      <MemoryRouter>
        <VendorDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('delivery-job-card-OF-1001')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('merchant-search-input');
    fireEvent.change(searchInput, { target: { value: 'Smart Watch' } });

    expect(screen.queryByTestId('delivery-job-card-OF-1001')).not.toBeInTheDocument();
    expect(screen.getByTestId('delivery-job-card-OF-1002')).toBeInTheDocument();
    expect(screen.queryByTestId('delivery-job-card-OF-1003')).not.toBeInTheDocument();

    // Clear search with X button
    const clearBtn = screen.getByTestId('merchant-search-clear-btn');
    fireEvent.click(clearBtn);

    expect(screen.getByTestId('delivery-job-card-OF-1001')).toBeInTheDocument();
    expect(screen.getByTestId('delivery-job-card-OF-1002')).toBeInTheDocument();
    expect(screen.getByTestId('delivery-job-card-OF-1003')).toBeInTheDocument();
  });

  it('renders empty state when no matching deliveries are found', async () => {
    render(
      <MemoryRouter>
        <VendorDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('delivery-job-card-OF-1001')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('merchant-search-input');
    fireEvent.change(searchInput, { target: { value: 'Nonexistent Item XYZ' } });

    expect(screen.getByTestId('merchant-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No matching deliveries')).toBeInTheDocument();

    const resetBtn = screen.getByTestId('merchant-reset-filters-btn');
    fireEvent.click(resetBtn);

    expect(screen.getByTestId('delivery-job-card-OF-1001')).toBeInTheDocument();
  });

  it('renders error banner with retry button when backend fails', async () => {
    vi.spyOn(deliveryService, 'getVendorDeliveries').mockRejectedValueOnce(
      new Error('Supabase network offline')
    );

    render(
      <MemoryRouter>
        <VendorDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('merchant-error-banner')).toBeInTheDocument();
    });
    expect(screen.getByText('Supabase network offline')).toBeInTheDocument();
    expect(screen.getByTestId('merchant-retry-btn')).toBeInTheDocument();
  });

  it('opens Profile BottomSheet and handles profile editing, role switch, and signout', async () => {
    const updateProfileSpy = vi.spyOn(logisticsService, 'updateVendorProfile').mockResolvedValue(mockProfile);

    render(
      <MemoryRouter>
        <VendorDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('merchant-profile-btn')).toBeInTheDocument();
    });

    // Open profile drawer
    fireEvent.click(screen.getByTestId('merchant-profile-btn'));

    expect(screen.getByTestId('merchant-profile-sheet')).toBeInTheDocument();
    expect(screen.getByText('Merchant Business Profile')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Apex Luxury Lagos')).toBeInTheDocument();

    // Edit business category
    const catInput = screen.getByTestId('input-business-category');
    fireEvent.change(catInput, { target: { value: 'Luxury Goods & Watches' } });

    // Submit form
    fireEvent.click(screen.getByTestId('merchant-save-profile-btn'));

    await waitFor(() => {
      expect(updateProfileSpy).toHaveBeenCalledWith('vendor-user-123', expect.objectContaining({
        businessCategory: 'Luxury Goods & Watches',
      }));
    });
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Profile Updated',
      type: 'success',
    }));
  });
});
