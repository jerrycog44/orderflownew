import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProviderDashboardPage } from '../ProviderDashboardPage';
import { deliveryService } from '../../services/deliveryService';
import { logisticsService } from '../../services/logisticsService';
import type { DeliveryRecord, LogisticsProviderProfile, User } from '../../types';

// Mock AuthContext
const mockProviderUser: User = {
  id: 'provider-user-456',
  fullName: 'Kolawole Balogun',
  email: 'kola@swifthaul.ng',
  phone: '+2348099887766',
  role: 'logistics_provider',
  onboardingCompleted: true,
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-20T10:00:00Z',
};

const mockSignOut = vi.fn();
const mockSetRole = vi.fn().mockResolvedValue({ error: null });

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockProviderUser,
    signOut: mockSignOut,
    setRole: mockSetRole,
    role: 'logistics_provider',
    isAuthenticated: true,
    isLoading: false,
    hasCompletedOnboarding: true,
  }),
  useOptionalAuth: () => ({
    user: mockProviderUser,
    signOut: mockSignOut,
    setRole: mockSetRole,
    role: 'logistics_provider',
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

// Sample Provider Profile
const sampleProfile: LogisticsProviderProfile = {
  userId: 'provider-user-456',
  providerName: 'SwiftHaul Express Logistics',
  providerType: 'courier',
  coverageArea: 'Ibadan (Bodija, Ring Road, Dugbe)',
  vehicleTypes: ['motorcycle', 'van'],
  packageCategories: ['parcel', 'box'],
  availability: 'available',
  createdAt: '2026-10-20T10:00:00Z',
};

// Sample Targeted Opportunity
const sampleTargetedOpportunity: DeliveryRecord = {
  id: 'del-targeted-01',
  trackingCode: 'OF-TGT-01',
  vendorId: 'vendor-101',
  vendorName: 'Zainab Fabrics',
  productName: 'Silk Kaftan Set',
  package: {
    productName: 'Silk Kaftan Set',
    itemCategory: 'Textiles',
    packageType: 'parcel',
    quantity: 2,
    weightKg: 1.5,
    dimensionsCm: { length: 25, width: 20, height: 10 },
    fragile: false,
  },
  pickup: { address: '14 New Court Road', city: 'Ibadan' },
  destination: { address: '32 Secretariat Road', city: 'Bodija, Ibadan' },
  recipient: { name: 'Dr. Yemi Alade', phone: '+2348022223333' },
  status: 'opportunity_sent',
  paymentMethod: 'cash_on_delivery',
  requirePhotoProof: true,
  estimatedPrice: 2800,
  estimatedDeliveryTime: 'Within 45 mins',
  createdAt: '2026-10-24T12:00:00Z',
  updatedAt: '2026-10-24T12:00:00Z',
};

// Sample Open Broadcast Opportunities
const sampleOpportunities: DeliveryRecord[] = [
  {
    id: 'opp-001',
    trackingCode: 'OF-OPP-01',
    vendorId: 'vendor-102',
    vendorName: 'Fresh Mart Supermarket',
    productName: 'Grocery Hamper',
    package: {
      productName: 'Grocery Hamper',
      itemCategory: 'Food & Groceries',
      packageType: 'box',
      quantity: 1,
      weightKg: 4.2,
      dimensionsCm: { length: 40, width: 30, height: 25 },
      fragile: true,
    },
    pickup: { address: 'Ring Road Mall', city: 'Ibadan' },
    destination: { address: 'University of Ibadan Campus', city: 'Ibadan' },
    recipient: { name: 'Prof. Adeyemi', phone: '+2348077778888' },
    status: 'awaiting_pickup',
    paymentMethod: 'pay_at_pickup',
    requirePhotoProof: false,
    estimatedPrice: 4200,
    estimatedDeliveryTime: 'Today',
    createdAt: '2026-10-24T11:00:00Z',
    updatedAt: '2026-10-24T11:00:00Z',
  },
];

// Sample Assigned Deliveries (Active and Completed)
const sampleAssignedDeliveries: DeliveryRecord[] = [
  {
    id: 'assigned-active-01',
    trackingCode: 'OF-ACT-01',
    vendorId: 'vendor-103',
    vendorName: 'GadgetZone',
    productName: 'Wireless Earbuds',
    package: {
      productName: 'Wireless Earbuds',
      itemCategory: 'Electronics',
      packageType: 'parcel',
      quantity: 1,
      weightKg: 0.3,
      dimensionsCm: { length: 10, width: 10, height: 5 },
      fragile: true,
    },
    pickup: { address: 'Dugbe Commercial Center', city: 'Ibadan' },
    destination: { address: 'Oluyole Estate', city: 'Ibadan' },
    recipient: { name: 'Chinedu Eze', phone: '+2348033334444' },
    status: 'in_transit',
    paymentMethod: 'cash_on_delivery',
    requirePhotoProof: true,
    estimatedPrice: 3000,
    estimatedDeliveryTime: 'Today',
    createdAt: '2026-10-24T09:30:00Z',
    updatedAt: '2026-10-24T10:15:00Z',
  },
  {
    id: 'assigned-completed-01',
    trackingCode: 'OF-CMP-01',
    vendorId: 'vendor-104',
    vendorName: 'Luxe Cosmetics',
    productName: 'Skincare Bundle',
    package: {
      productName: 'Skincare Bundle',
      itemCategory: 'Beauty & Skincare',
      packageType: 'parcel',
      quantity: 1,
      weightKg: 0.8,
      dimensionsCm: { length: 20, width: 15, height: 10 },
      fragile: false,
    },
    pickup: { address: 'Bodija Market Road', city: 'Ibadan' },
    destination: { address: 'Agodi GRA', city: 'Ibadan' },
    recipient: { name: 'Mrs. Folake Craig', phone: '+2348055556666' },
    status: 'delivered',
    paymentMethod: 'pay_at_pickup',
    requirePhotoProof: false,
    estimatedPrice: 3500,
    estimatedDeliveryTime: 'Delivered',
    podCompletedAt: '2026-10-24T11:45:00Z',
    createdAt: '2026-10-24T08:00:00Z',
    updatedAt: '2026-10-24T11:45:00Z',
  },
];

describe('Provider & Rider Mobile Experience (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(logisticsService, 'getProviderProfile').mockResolvedValue(sampleProfile);
    vi.spyOn(logisticsService, 'updateProviderAvailability').mockResolvedValue(true);
    vi.spyOn(logisticsService, 'updateProviderProfile').mockResolvedValue(sampleProfile);

    vi.spyOn(deliveryService, 'getProviderTargetedOpportunity').mockResolvedValue(sampleTargetedOpportunity);
    vi.spyOn(deliveryService, 'getProviderOpportunities').mockResolvedValue(sampleOpportunities);
    vi.spyOn(deliveryService, 'getProviderAssignedDeliveries').mockResolvedValue(sampleAssignedDeliveries);
    vi.spyOn(deliveryService, 'subscribeToProviderDispatches').mockReturnValue(() => {});
    vi.spyOn(deliveryService, 'acceptDelivery').mockResolvedValue(sampleOpportunities[0]);
    vi.spyOn(deliveryService, 'declineOpportunity').mockResolvedValue(true);
    vi.spyOn(deliveryService, 'updateDeliveryStatus').mockResolvedValue(sampleAssignedDeliveries[0]);
    vi.spyOn(deliveryService, 'completeDeliveryWithPod').mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders mobile header with fleet name, coverage area, and courier badge', async () => {
    render(
      <MemoryRouter>
        <ProviderDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('rider-dashboard-page')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mobile-header-title')).toHaveTextContent('SwiftHaul Express Logistics');
    expect(screen.getByTestId('mobile-header-subtitle')).toHaveTextContent('Ibadan (Bodija, Ring Road, Dugbe)');
    expect(screen.getByTestId('mobile-header-badge')).toHaveTextContent('Courier');
    expect(screen.getByTestId('rider-refresh-btn')).toBeInTheDocument();
    expect(screen.getByTestId('rider-profile-btn')).toBeInTheDocument();
  });

  it('provides segmented availability controls with Online, Busy, and Offline states', async () => {
    render(
      <MemoryRouter>
        <ProviderDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('rider-availability-toggle')).toBeInTheDocument();
    });

    const onlineBtn = screen.getByTestId('avail-online-btn');
    const busyBtn = screen.getByTestId('avail-busy-btn');
    const offlineBtn = screen.getByTestId('avail-offline-btn');

    expect(onlineBtn).toHaveClass('active');
    expect(busyBtn).not.toHaveClass('active');
    expect(offlineBtn).not.toHaveClass('active');

    // Switch to Offline
    fireEvent.click(offlineBtn);
    expect(logisticsService.updateProviderAvailability).toHaveBeenCalledWith('provider-user-456', 'unavailable');

    // Offline warning banner should become visible
    await waitFor(() => {
      expect(screen.getByTestId('rider-offline-banner')).toBeInTheDocument();
    });

    // Switch back to Online
    fireEvent.click(onlineBtn);
    expect(logisticsService.updateProviderAvailability).toHaveBeenCalledWith('provider-user-456', 'available');

    await waitFor(() => {
      expect(screen.queryByTestId('rider-offline-banner')).not.toBeInTheDocument();
    });
  });

  it('displays accurate glanceable operational metrics including real completed earnings', async () => {
    render(
      <MemoryRouter>
        <ProviderDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('metric-open-offers')).toBeInTheDocument();
    });

    // Open Offers: sampleOpportunities.length = 1
    expect(screen.getByTestId('metric-open-offers')).toHaveTextContent('1');

    // Active Jobs: sampleAssignedDeliveries status !== 'delivered' = 1
    expect(screen.getByTestId('metric-active-jobs')).toHaveTextContent('1');

    // Delivered: sampleAssignedDeliveries status === 'delivered' = 1
    expect(screen.getByTestId('metric-completed-jobs')).toHaveTextContent('1');

    // Settled Payout (strictly sum of delivered: 3500)
    expect(screen.getByTestId('metric-real-earnings')).toHaveTextContent('₦3,500');
  });

  it('renders high-priority targeted opportunity card with Accept and Decline actions', async () => {
    render(
      <MemoryRouter>
        <ProviderDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('targeted-opportunity-card')).toBeInTheDocument();
    });

    expect(screen.getByText('Silk Kaftan Set')).toBeInTheDocument();
    expect(screen.getByText('₦2,800')).toBeInTheDocument();
    expect(screen.getByTestId('targeted-accept-btn')).toBeInTheDocument();
    expect(screen.getByTestId('targeted-decline-btn')).toBeInTheDocument();

    // Test Accept
    fireEvent.click(screen.getByTestId('targeted-accept-btn'));
    expect(deliveryService.acceptDelivery).toHaveBeenCalledWith(
      'del-targeted-01',
      'provider-user-456',
      'SwiftHaul Express Logistics'
    );
  });

  it('allows declining a targeted opportunity to route it to another courier', async () => {
    render(
      <MemoryRouter>
        <ProviderDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('targeted-decline-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('targeted-decline-btn'));
    expect(deliveryService.declineOpportunity).toHaveBeenCalledWith('del-targeted-01', 'provider-user-456');
  });

  it('navigates between Available Offers, Active Jobs, and Delivered tabs', async () => {
    render(
      <MemoryRouter>
        <ProviderDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('rider-opportunities-list')).toBeInTheDocument();
    });

    // Check open offer item is present in tab 1
    expect(screen.getByTestId('opportunity-item-opp-001')).toBeInTheDocument();
    expect(screen.getByText('Grocery Hamper')).toBeInTheDocument();

    // Switch to Active Jobs tab
    const activePill = screen.getByTestId('filter-pill-active');
    fireEvent.click(activePill);

    await waitFor(() => {
      expect(screen.getByTestId('rider-active-list')).toBeInTheDocument();
    });
    expect(screen.getByTestId('active-job-assigned-active-01')).toBeInTheDocument();
    expect(screen.getByText('Wireless Earbuds')).toBeInTheDocument();

    // Switch to Delivered tab
    const completedPill = screen.getByTestId('filter-pill-completed');
    fireEvent.click(completedPill);

    await waitFor(() => {
      expect(screen.getByTestId('rider-completed-list')).toBeInTheDocument();
    });
    expect(screen.getByTestId('completed-job-assigned-completed-01')).toBeInTheDocument();
    expect(screen.getByText('Skincare Bundle')).toBeInTheDocument();
    expect(screen.getByText('+₦3,500')).toBeInTheDocument();
  });

  it('provides quick call link to recipient for active jobs', async () => {
    render(
      <MemoryRouter>
        <ProviderDashboardPage />
      </MemoryRouter>
    );

    // Switch to Active Jobs tab
    await waitFor(() => {
      expect(screen.getByTestId('filter-pill-active')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('filter-pill-active'));

    await waitFor(() => {
      expect(screen.getByLabelText('Call recipient Chinedu Eze')).toHaveAttribute('href', 'tel:+2348033334444');
    });
  });

  it('handles Proof of Delivery (POD) handover flow with PIN and COD collection reminder', async () => {
    render(
      <MemoryRouter>
        <ProviderDashboardPage />
      </MemoryRouter>
    );

    // Switch to Active Jobs
    await waitFor(() => {
      expect(screen.getByTestId('filter-pill-active')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('filter-pill-active'));

    await waitFor(() => {
      expect(screen.getByTestId('complete-delivery-btn-assigned-active-01')).toBeInTheDocument();
    });

    // Click "Confirm Handover (POD)"
    fireEvent.click(screen.getByTestId('complete-delivery-btn-assigned-active-01'));

    await waitFor(() => {
      expect(screen.getByTestId('pod-handover-sheet')).toBeInTheDocument();
    });

    // Check COD alert is present since paymentMethod is cash_on_delivery
    expect(screen.getByText(/Cash on Delivery Collection Required/i)).toBeInTheDocument();

    // Try submitting without PIN -> shows error
    fireEvent.click(screen.getByTestId('pod-verify-submit-btn'));
    expect(screen.getByTestId('pod-error-message')).toHaveTextContent(
      'Please enter the 4-digit verification code provided by the customer.'
    );

    // Enter 4-digit PIN
    const pinInput = screen.getByTestId('input-pod-pin');
    fireEvent.change(pinInput, { target: { value: '4892' } });

    // Try submitting without photo (since requirePhotoProof is true)
    fireEvent.click(screen.getByTestId('pod-verify-submit-btn'));
    expect(screen.getByTestId('pod-error-message')).toHaveTextContent(
      'Vendor has required photo proof of delivery. Please capture or upload a handover photo.'
    );

    // Simulate photo file selection
    const fileInput = screen.getByTestId('input-pod-photo');
    const dummyFile = new File(['proof-image-binary'], 'handover.jpg', { type: 'image/jpeg' });

    // Mock FileReader with a constructible class
    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      readAsDataURL(_file: Blob) {
        this.result = 'data:image/jpeg;base64,dummybase64string';
        if (this.onload) this.onload();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    fireEvent.change(fileInput, { target: { files: [dummyFile] } });

    // Now submit verified handover
    fireEvent.click(screen.getByTestId('pod-verify-submit-btn'));

    await waitFor(() => {
      expect(deliveryService.completeDeliveryWithPod).toHaveBeenCalledWith(
        'assigned-active-01',
        '4892',
        'data:image/jpeg;base64,dummybase64string'
      );
    });
  });

  it('opens fleet profile bottom sheet, updates territory, and supports role switching', async () => {
    render(
      <MemoryRouter>
        <ProviderDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('rider-profile-btn')).toBeInTheDocument();
    });

    // Open profile drawer
    fireEvent.click(screen.getByTestId('rider-profile-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('rider-profile-sheet')).toBeInTheDocument();
    });

    expect(screen.getByTestId('input-fleet-name')).toHaveValue('SwiftHaul Express Logistics');
    expect(screen.getByTestId('input-coverage-area')).toHaveValue('Ibadan (Bodija, Ring Road, Dugbe)');

    // Edit fleet territory
    fireEvent.change(screen.getByTestId('input-coverage-area'), {
      target: { value: 'All Oyo State, Ibadan Metropolitan' },
    });
    fireEvent.click(screen.getByTestId('rider-save-profile-btn'));

    await waitFor(() => {
      expect(logisticsService.updateProviderProfile).toHaveBeenCalledWith('provider-user-456', {
        providerName: 'SwiftHaul Express Logistics',
        coverageArea: 'All Oyo State, Ibadan Metropolitan',
      });
    });

    // Test workspace role switch
    fireEvent.click(screen.getByTestId('rider-profile-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('rider-switch-role-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('rider-switch-role-btn'));
    expect(mockSetRole).toHaveBeenCalledWith('vendor');

    // Test sign out
    fireEvent.click(screen.getByTestId('rider-profile-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('rider-sign-out-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('rider-sign-out-btn'));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
