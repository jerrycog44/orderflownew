import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Package,
  Truck,
  Clock,
  CheckCircle2,
  Search,
  X,
  RotateCw,
  User as UserIcon,
  AlertCircle,
  PackageOpen,
  Repeat,
  LogOut,
  Building,
  LayoutGrid,
  List,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { deliveryService } from '../services/deliveryService';
import { logisticsService } from '../services/logisticsService';
import { useToast } from '../components/ui/Toast';
import {
  MobileHeader,
  DeliveryJobCard,
  StatusFilterPills,
  BottomSheet,
} from '../components/mobile';
import { getStatusBadgeConfig } from '../components/mobile/deliveryStatusHelpers';
import type { FilterPillItem } from '../components/mobile';
import type { VendorProfile, DeliveryRecord } from '../types';
import './VendorDashboardPage.css';

export const VendorDashboardPage: React.FC = () => {
  const { user, signOut, setRole } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Profile Drawer state
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCity, setEditCity] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch data
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setLoadError(null);

      try {
        const [prof, userDeliveries] = await Promise.all([
          logisticsService.getVendorProfile(user.id),
          deliveryService.getVendorDeliveries(user.id),
        ]);

        if (isMounted) {
          setProfile(prof);
          setDeliveries(userDeliveries);

          if (prof) {
            setEditBusinessName(prof.businessName || '');
            setEditCategory(prof.businessCategory || '');
            setEditCity(prof.operatingCity || '');
          }
        }
      } catch (err) {
        console.error('Failed to load vendor dashboard data:', err);
        if (isMounted) {
          setLoadError(err instanceof Error ? err.message : 'Failed to connect to deliveries database.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [user, refreshTrigger]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsSavingProfile(true);
    try {
      await logisticsService.updateVendorProfile(user.id, {
        businessName: editBusinessName.trim(),
        businessCategory: editCategory.trim(),
        operatingCity: editCity.trim(),
      });

      addToast({
        title: 'Profile Updated',
        description: 'Business information saved successfully.',
        type: 'success',
      });

      setProfile({
        userId: user.id,
        businessName: editBusinessName.trim(),
        businessCategory: editCategory.trim(),
        operatingCity: editCity.trim(),
        createdAt: profile?.createdAt || new Date().toISOString(),
      });

      setProfileSheetOpen(false);
      window.dispatchEvent(new CustomEvent('of:profile-updated'));
    } catch (err) {
      console.error('Profile update failed:', err);
      addToast({
        title: 'Update Failed',
        description: 'Could not save profile changes. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRoleSwitch = async () => {
    setProfileSheetOpen(false);
    const { error } = await setRole('logistics_provider');
    if (!error) {
      addToast({
        title: 'Switched Workspace',
        description: 'Now operating in Logistics Provider workspace.',
        type: 'info',
      });
      navigate('/logistics/dashboard');
    }
  };

  const handleSignOut = () => {
    setProfileSheetOpen(false);
    signOut();
    navigate('/login');
  };

  // Metrics computation from real deliveries
  const pendingCount = deliveries.filter(
    (d) =>
      d.status === 'awaiting_pickup' ||
      d.status === 'searching' ||
      d.status === 'opportunity_sent' ||
      d.status === 'provider_selected' ||
      d.status === 'created'
  ).length;

  const inTransitCount = deliveries.filter((d) => d.status === 'in_transit' || d.status === 'picked_up').length;
  const deliveredCount = deliveries.filter((d) => d.status === 'delivered').length;

  // Filter pills configuration
  const filterItems: FilterPillItem[] = [
    { key: 'all', label: 'All Orders', count: deliveries.length },
    { key: 'pending', label: 'In Progress', count: pendingCount },
    { key: 'in_transit', label: 'In Transit', count: inTransitCount },
    { key: 'delivered', label: 'Delivered', count: deliveredCount },
  ];

  // Filtering logic
  const filteredDeliveries = deliveries.filter((d) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      d.id.toLowerCase().includes(query) ||
      (d.trackingCode && d.trackingCode.toLowerCase().includes(query)) ||
      d.productName.toLowerCase().includes(query) ||
      d.recipient.name.toLowerCase().includes(query) ||
      d.destination.city.toLowerCase().includes(query);

    let matchesStatus = true;
    if (statusFilter === 'pending') {
      matchesStatus =
        d.status === 'created' ||
        d.status === 'searching' ||
        d.status === 'opportunity_sent' ||
        d.status === 'awaiting_pickup' ||
        d.status === 'provider_selected';
    } else if (statusFilter === 'in_transit') {
      matchesStatus = d.status === 'in_transit' || d.status === 'picked_up';
    } else if (statusFilter === 'delivered') {
      matchesStatus = d.status === 'delivered';
    }

    return matchesQuery && matchesStatus;
  });

  return (
    <div className="of-merchant-page" data-testid="merchant-dashboard-page">
      {/* 1. Mobile Safe Header */}
      <MobileHeader
        title={profile?.businessName || 'Merchant Hub'}
        subtitle={user?.fullName || 'Active Dispatches'}
        workspaceBadge="Vendor"
        rightAction={
          <div className="of-m-header-actions">
            <button
              type="button"
              className={`of-m-icon-btn ${isRefreshing ? 'is-spinning' : ''}`}
              onClick={handleRefresh}
              aria-label="Refresh deliveries list"
              title="Refresh list"
              data-testid="merchant-refresh-btn"
            >
              <RotateCw size={20} />
            </button>
            <button
              type="button"
              className="of-m-icon-btn"
              onClick={() => setProfileSheetOpen(true)}
              aria-label="View Business Profile"
              title="Business Profile"
              data-testid="merchant-profile-btn"
            >
              <UserIcon size={20} />
            </button>
          </div>
        }
      />

      <div className="of-merchant-container">
        {/* 2. Quick Action Banner */}
        <section className="of-merchant-cta-banner" aria-label="Dispatch Parcel">
          <div className="of-merchant-cta-text">
            <h2 className="of-merchant-cta-title">Dispatch a Parcel</h2>
            <p className="of-merchant-cta-desc">Match instantly with verified couriers</p>
          </div>
          <button
            type="button"
            className="of-merchant-cta-btn"
            onClick={() => navigate('/vendor/deliveries/create')}
            data-testid="merchant-create-delivery-cta"
          >
            <Plus size={18} strokeWidth={2.4} />
            <span>Create</span>
          </button>
        </section>

        {/* 3. Operational Metrics Grid */}
        <section className="of-merchant-metrics-grid" aria-label="Key Logistics Metrics">
          <div className="of-m-metric-card" data-testid="metric-total-orders">
            <div className="of-m-metric-top">
              <span className="of-m-metric-label">Total Orders</span>
              <div className="of-m-metric-icon neutral">
                <Package size={16} />
              </div>
            </div>
            <p className="of-m-metric-value">{deliveries.length}</p>
          </div>

          <div className="of-m-metric-card" data-testid="metric-pending-dispatch">
            <div className="of-m-metric-top">
              <span className="of-m-metric-label">In Progress</span>
              <div className="of-m-metric-icon warning">
                <Clock size={16} />
              </div>
            </div>
            <p className="of-m-metric-value">{pendingCount}</p>
          </div>

          <div className="of-m-metric-card" data-testid="metric-in-transit">
            <div className="of-m-metric-top">
              <span className="of-m-metric-label">In Transit</span>
              <div className="of-m-metric-icon info">
                <Truck size={16} />
              </div>
            </div>
            <p className="of-m-metric-value">{inTransitCount}</p>
          </div>

          <div className="of-m-metric-card" data-testid="metric-delivered">
            <div className="of-m-metric-top">
              <span className="of-m-metric-label">Delivered</span>
              <div className="of-m-metric-icon success">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <p className="of-m-metric-value">{deliveredCount}</p>
          </div>
        </section>

        {/* 4. Error State Banner (if network or DB issue occurred) */}
        {loadError && (
          <div className="of-merchant-error-banner" role="alert" data-testid="merchant-error-banner">
            <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div className="of-merchant-error-content">
              <p className="of-merchant-error-title">Unable to sync deliveries</p>
              <p className="of-merchant-error-desc">{loadError}</p>
              <button
                type="button"
                className="of-merchant-cta-btn"
                style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px' }}
                onClick={handleRefresh}
                data-testid="merchant-retry-btn"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* 5. Mobile Search Bar */}
        <div className="of-merchant-search-bar">
          <Search size={18} className="of-merchant-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="of-merchant-search-input"
            placeholder="Search by ID, product, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search deliveries"
            data-testid="merchant-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="of-merchant-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              data-testid="merchant-search-clear-btn"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* 6. Filter Carousel */}
        <StatusFilterPills
          items={filterItems}
          selectedKey={statusFilter}
          onSelect={setStatusFilter}
        />

        {/* 7. Section Header & View Switcher */}
        <div className="of-merchant-section-header">
          <h3 className="of-merchant-section-title">
            <span>Dispatches Directory</span>
            <span className="of-merchant-count-badge" data-testid="merchant-filtered-count">
              {filteredDeliveries.length}
            </span>
          </h3>

          <div className="of-merchant-view-switcher" role="group" aria-label="View Mode">
            <button
              type="button"
              className={`of-merchant-view-btn ${viewMode === 'cards' ? 'is-active' : ''}`}
              onClick={() => setViewMode('cards')}
              aria-label="Cards view"
              title="Cards view"
            >
              <LayoutGrid size={16} />
              <span className="of-desktop-only-text">Cards</span>
            </button>
            <button
              type="button"
              className={`of-merchant-view-btn ${viewMode === 'table' ? 'is-active' : ''}`}
              onClick={() => setViewMode('table')}
              aria-label="Table view"
              title="Table view"
            >
              <List size={16} />
              <span className="of-desktop-only-text">Table</span>
            </button>
          </div>
        </div>

        {/* 8. Deliveries List (5 standard states) */}
        <section className="of-merchant-list" aria-label="Deliveries List">
          {isLoading ? (
            // State: Loading Skeletons
            <div data-testid="merchant-skeleton-loader">
              {[1, 2, 3].map((n) => (
                <div key={n} className="of-m-skeleton-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <div className="of-m-skeleton-line" style={{ width: '90px', height: '22px' }} />
                    <div className="of-m-skeleton-line" style={{ width: '80px', height: '22px' }} />
                  </div>
                  <div className="of-m-skeleton-line" style={{ width: '100%', height: '40px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', paddingTop: '8px' }}>
                    <div className="of-m-skeleton-line" style={{ width: '120px', height: '24px' }} />
                    <div className="of-m-skeleton-line" style={{ width: '40px', height: '24px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDeliveries.length === 0 ? (
            // State: Empty View
            <div className="of-merchant-empty-state" data-testid="merchant-empty-state">
              <div className="of-m-empty-icon-box">
                <PackageOpen size={30} />
              </div>
              <h4 className="of-m-empty-title">
                {searchQuery || statusFilter !== 'all' ? 'No matching deliveries' : 'No deliveries created yet'}
              </h4>
              <p className="of-m-empty-desc">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search terms or changing your status filter.'
                  : 'Start sending parcels with guaranteed proof-of-delivery and instant courier dispatch.'}
              </p>
              {searchQuery || statusFilter !== 'all' ? (
                <button
                  type="button"
                  className="of-merchant-cta-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  data-testid="merchant-reset-filters-btn"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  type="button"
                  className="of-merchant-cta-btn"
                  onClick={() => navigate('/vendor/deliveries/create')}
                  data-testid="merchant-empty-create-btn"
                >
                  <Plus size={16} />
                  <span>Create First Delivery</span>
                </button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            // State: Desktop Data Table View
            <div className="of-merchant-table-wrapper" data-testid="merchant-table-view">
              <table className="of-merchant-table">
                <thead>
                  <tr>
                    <th>Tracking / ID</th>
                    <th>Product & Category</th>
                    <th>Route</th>
                    <th>Recipient</th>
                    <th>Status</th>
                    <th>Fare</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.map((delivery) => {
                    const trackingCode = delivery.trackingCode || (delivery.id ? delivery.id.slice(0, 8).toUpperCase() : 'OF-NEW');
                    const statusConfig = getStatusBadgeConfig(delivery.status);
                    return (
                      <tr
                        key={delivery.id}
                        data-testid={`delivery-job-card-${trackingCode}`}
                        onClick={() => navigate(`/vendor/deliveries/${delivery.id}`)}
                        className="of-merchant-table-row"
                        tabIndex={0}
                      >
                        <td className="of-table-cell-tracking">
                          <span className="of-table-code">{trackingCode}</span>
                          <span className="of-table-date">{new Date(delivery.createdAt).toLocaleDateString()}</span>
                        </td>
                        <td>
                          <div className="of-table-product-name">{delivery.productName}</div>
                          <div className="of-table-product-sub">
                            {delivery.package?.itemCategory || 'Parcel'} • {delivery.package?.weightKg || 0}kg
                          </div>
                        </td>
                        <td>
                          <div className="of-table-route-node">
                            <span className="of-table-dot pickup" />
                            <span>{delivery.pickup?.city || 'Origin'}</span>
                          </div>
                          <div className="of-table-route-node">
                            <span className="of-table-dot dest" />
                            <span>{delivery.destination?.city || 'Destination'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="of-table-recipient-name">{delivery.recipient?.name}</div>
                          <div className="of-table-recipient-phone">{delivery.recipient?.phone}</div>
                        </td>
                        <td>
                          <span className={`of-m-status-pill ${statusConfig.className}`}>
                            <span className="of-m-status-dot" aria-hidden="true" />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="of-table-price">
                          ₦{(delivery.estimatedPrice || 0).toLocaleString()}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="of-table-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/vendor/deliveries/${delivery.id}`);
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            // State: Cards Grid View
            <div data-testid="merchant-active-list" className="of-merchant-cards-grid">
              {filteredDeliveries.map((delivery) => (
                <DeliveryJobCard
                  key={delivery.id}
                  delivery={delivery}
                  onClick={() => navigate(`/vendor/deliveries/${delivery.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 9. Profile & Workspace BottomSheet */}
      <BottomSheet
        isOpen={profileSheetOpen}
        onClose={() => setProfileSheetOpen(false)}
        title="Merchant Business Profile"
        description="Manage your store details and operational settings"
      >
        <div className="of-merchant-profile-sheet" data-testid="merchant-profile-sheet">
          <div className="of-m-profile-hero">
            <div className="of-m-profile-avatar">
              <Building size={24} />
            </div>
            <div className="of-m-profile-info">
              <p className="of-m-profile-name">
                {profile?.businessName || user?.fullName || 'Commercial Vendor'}
              </p>
              <p className="of-m-profile-email">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="of-m-profile-form">
            <div className="of-m-form-group">
              <label htmlFor="vendor-business-name" className="of-m-form-label">
                Business / Store Name
              </label>
              <input
                id="vendor-business-name"
                type="text"
                className="of-m-form-input"
                value={editBusinessName}
                onChange={(e) => setEditBusinessName(e.target.value)}
                placeholder="e.g. Apex Luxury & Retail"
                required
                data-testid="input-business-name"
              />
            </div>

            <div className="of-m-form-group">
              <label htmlFor="vendor-business-cat" className="of-m-form-label">
                Commercial Category
              </label>
              <input
                id="vendor-business-cat"
                type="text"
                className="of-m-form-input"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="e.g. Fashion, Electronics"
                required
                data-testid="input-business-category"
              />
            </div>

            <div className="of-m-form-group">
              <label htmlFor="vendor-business-city" className="of-m-form-label">
                Operating City / Hub
              </label>
              <input
                id="vendor-business-city"
                type="text"
                className="of-m-form-input"
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                placeholder="e.g. Ibadan, Lagos"
                required
                data-testid="input-business-city"
              />
            </div>

            <button
              type="submit"
              className="of-merchant-cta-btn"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={isSavingProfile}
              data-testid="merchant-save-profile-btn"
            >
              {isSavingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <div className="of-m-profile-actions">
            <button
              type="button"
              className="of-m-action-btn-row"
              onClick={handleRoleSwitch}
              data-testid="merchant-switch-role-btn"
            >
              <Repeat size={18} />
              <span>Switch to Logistics Provider View</span>
            </button>

            <button
              type="button"
              className="of-m-action-btn-row is-danger"
              onClick={handleSignOut}
              data-testid="merchant-sign-out-btn"
            >
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
