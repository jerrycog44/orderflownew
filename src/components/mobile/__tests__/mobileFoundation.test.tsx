import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  MobileHeader,
  MobileBottomNav,
  BottomSheet,
  DeliveryJobCard,
  getStatusBadgeConfig,
  StatusFilterPills,
  MobileAppShell,
} from '../index';
import type { DeliveryRecord } from '../../../types';

describe('Phase 3: OrderFlow Mobile Design Tokens & Reusable Foundation', () => {
  afterEach(() => {
    cleanup();
  });

  describe('MobileHeader', () => {
    it('renders title, subtitle, and role workspace badge', () => {
      render(
        <MemoryRouter>
          <MobileHeader
            title="Merchant Hub"
            subtitle="Active Dispatches"
            workspaceBadge="Vendor"
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mobile-header-title')).toHaveTextContent('Merchant Hub');
      expect(screen.getByTestId('mobile-header-subtitle')).toHaveTextContent('Active Dispatches');
      expect(screen.getByTestId('mobile-header-badge')).toHaveTextContent('Vendor');
    });

    it('renders back button and triggers onBack handler', () => {
      const handleBack = vi.fn();
      render(
        <MemoryRouter>
          <MobileHeader title="Create Dispatch" showBack onBack={handleBack} />
        </MemoryRouter>
      );

      const backBtn = screen.getByTestId('mobile-header-back-btn');
      expect(backBtn).toBeInTheDocument();
      fireEvent.click(backBtn);
      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    it('renders custom right actions', () => {
      render(
        <MemoryRouter>
          <MobileHeader
            title="Dashboard"
            rightAction={<button data-testid="custom-action-btn">Filter</button>}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('custom-action-btn')).toBeInTheDocument();
    });
  });

  describe('MobileBottomNav', () => {
    it('renders vendor tabs when role is vendor', () => {
      render(
        <MemoryRouter initialEntries={['/vendor/dashboard']}>
          <MobileBottomNav roleOverride="vendor" />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mobile-nav-vendor-orders')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav-vendor-create')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav-vendor-track')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav-vendor-profile')).toBeInTheDocument();
    });

    it('renders provider tabs when role is logistics_provider', () => {
      render(
        <MemoryRouter initialEntries={['/logistics/dashboard']}>
          <MobileBottomNav roleOverride="logistics_provider" />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mobile-nav-provider-dispatches')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav-provider-track')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav-provider-profile')).toBeInTheDocument();
    });

    it('handles custom click action items', () => {
      const handleActionClick = vi.fn();
      const customItems = [
        {
          id: 'custom-action',
          label: 'Scan QR',
          icon: <span>QR</span>,
          onClick: handleActionClick,
        },
      ];

      render(
        <MemoryRouter>
          <MobileBottomNav customItems={customItems} />
        </MemoryRouter>
      );

      const actionBtn = screen.getByTestId('mobile-nav-custom-action');
      fireEvent.click(actionBtn);
      expect(handleActionClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('BottomSheet', () => {
    it('does not render when isOpen is false', () => {
      render(
        <BottomSheet isOpen={false} onClose={vi.fn()}>
          <div>Hidden Content</div>
        </BottomSheet>
      );

      expect(screen.queryByTestId('bottom-sheet-container')).not.toBeInTheDocument();
    });

    it('renders title, description, children, and close button when isOpen is true', () => {
      const handleClose = vi.fn();
      render(
        <BottomSheet
          isOpen={true}
          onClose={handleClose}
          title="Verify Delivery PIN"
          description="Enter the 4-digit code provided by the customer"
          footer={<button data-testid="sheet-submit">Verify</button>}
        >
          <div data-testid="sheet-body-content">PIN Input Field</div>
        </BottomSheet>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Verify Delivery PIN')).toBeInTheDocument();
      expect(screen.getByText(/Enter the 4-digit code/i)).toBeInTheDocument();
      expect(screen.getByTestId('sheet-body-content')).toBeInTheDocument();
      expect(screen.getByTestId('sheet-submit')).toBeInTheDocument();

      const closeBtn = screen.getByTestId('bottom-sheet-close-btn');
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape key press and backdrop click', () => {
      const handleClose = vi.fn();
      render(
        <BottomSheet isOpen={true} onClose={handleClose} title="Test Sheet">
          <p>Body</p>
        </BottomSheet>
      );

      // Escape key
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Backdrop click
      const backdrop = screen.getByTestId('bottom-sheet-backdrop');
      fireEvent.click(backdrop);
      expect(handleClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('DeliveryJobCard', () => {
    const mockDelivery: DeliveryRecord = {
      id: 'OF-TEST-123456',
      trackingCode: 'OF-9912',
      vendorId: 'vendor-1',
      vendorName: 'Gadget Store Lagos',
      productName: 'iPhone 15 Pro Max',
      package: {
        productName: 'iPhone 15 Pro Max',
        itemCategory: 'Electronics',
        packageType: 'parcel',
        quantity: 1,
        weightKg: 0.8,
        dimensionsCm: { length: 20, width: 15, height: 10 },
        fragile: true,
      },
      pickup: {
        address: '14 Allen Avenue',
        city: 'Ikeja',
      },
      destination: {
        address: '25 Admiralty Way',
        city: 'Lekki Phase 1',
      },
      recipient: {
        name: 'Chioma Adebayo',
        phone: '+2348012345678',
      },
      status: 'in_transit',
      estimatedPrice: 4500,
      estimatedDeliveryTime: 'Same day',
      createdAt: '2026-10-24T12:00:00Z',
      updatedAt: '2026-10-24T12:00:00Z',
    };

    it('renders tracking code, status badge, route pickup/dropoff, and metadata', () => {
      render(<DeliveryJobCard delivery={mockDelivery} />);

      expect(screen.getByTestId('delivery-card-tracking')).toHaveTextContent('OF-9912');
      expect(screen.getByTestId('delivery-card-status')).toHaveTextContent('In Transit');
      expect(screen.getByText('14 Allen Avenue, Ikeja')).toBeInTheDocument();
      expect(screen.getByText('25 Admiralty Way, Lekki Phase 1')).toBeInTheDocument();
      expect(screen.getByText('iPhone 15 Pro Max')).toBeInTheDocument();
      expect(screen.getByText('0.8 kg')).toBeInTheDocument();
      expect(screen.getByText('Fragile')).toBeInTheDocument();
      expect(screen.getByTestId('delivery-card-price')).toHaveTextContent('₦4,500');
    });

    it('triggers onClick and onAction handlers', () => {
      const handleCardClick = vi.fn();
      const handleAction = vi.fn();

      render(
        <DeliveryJobCard
          delivery={mockDelivery}
          actionLabel="Accept Job"
          onAction={handleAction}
          onClick={handleCardClick}
        />
      );

      const actionBtn = screen.getByTestId('delivery-card-action-btn');
      fireEvent.click(actionBtn);
      expect(handleAction).toHaveBeenCalledTimes(1);
      // Ensure stopPropagation prevented card click
      expect(handleCardClick).not.toHaveBeenCalled();

      // Click card itself
      const card = screen.getByTestId('delivery-job-card-OF-9912');
      fireEvent.click(card);
      expect(handleCardClick).toHaveBeenCalledTimes(1);
    });

    it('verifies getStatusBadgeConfig maps all operational statuses accurately', () => {
      expect(getStatusBadgeConfig('delivered')).toEqual({
        label: 'Delivered',
        className: 'of-m-status-success',
      });
      expect(getStatusBadgeConfig('in_transit')).toEqual({
        label: 'In Transit',
        className: 'of-m-status-info',
      });
      expect(getStatusBadgeConfig('searching_provider')).toEqual({
        label: 'Searching Dispatch',
        className: 'of-m-status-warning',
      });
      expect(getStatusBadgeConfig('cancelled')).toEqual({
        label: 'Cancelled',
        className: 'of-m-status-error',
      });
    });
  });

  describe('StatusFilterPills', () => {
    const filterItems = [
      { key: 'all', label: 'All Jobs', count: 18 },
      { key: 'active', label: 'Active', count: 4 },
      { key: 'completed', label: 'Completed', count: 14 },
    ];

    it('renders horizontal status tabs with counts and active indicator', () => {
      const handleSelect = vi.fn();
      render(
        <StatusFilterPills
          items={filterItems}
          selectedKey="active"
          onSelect={handleSelect}
        />
      );

      const activePill = screen.getByTestId('filter-pill-active');
      expect(activePill).toHaveClass('is-selected');
      expect(activePill).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('count-active')).toHaveTextContent('4');

      const allPill = screen.getByTestId('filter-pill-all');
      fireEvent.click(allPill);
      expect(handleSelect).toHaveBeenCalledWith('all');
    });
  });

  describe('MobileAppShell', () => {
    it('integrates header, content viewport, and bottom navigation', () => {
      render(
        <MemoryRouter initialEntries={['/vendor/dashboard']}>
          <MobileAppShell
            title="Merchant Hub"
            roleOverride="vendor"
          >
            <div data-testid="test-content">Dashboard Content</div>
          </MobileAppShell>
        </MemoryRouter>
      );

      expect(screen.getByTestId('mobile-app-shell')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-header-title')).toHaveTextContent('Merchant Hub');
      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();
    });

    it('supports hiding header or bottom nav when requested', () => {
      render(
        <MemoryRouter>
          <MobileAppShell hideHeader hideBottomNav>
            <div>Minimal View</div>
          </MobileAppShell>
        </MemoryRouter>
      );

      expect(screen.queryByTestId('mobile-header-title')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();
      expect(screen.getByTestId('mobile-shell-main')).toHaveClass('no-bottom-nav');
    });
  });
});
