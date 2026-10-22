import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, Package, Truck, Clock, CheckCircle2, Building, ChevronRight, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { deliveryService } from '../services/deliveryService';
import { logisticsService } from '../services/logisticsService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { VendorProfile, DeliveryRecord } from '../types';
import './VendorDashboardPage.css';

export const VendorDashboardPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
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
        }
      } catch (err) {
        console.error('Failed to load vendor dashboard data:', err);
        if (isMounted) {
          setLoadError(err instanceof Error ? err.message : 'Failed to connect to deliveries database.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Realtime subscription for live delivery status updates & new requests
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = deliveryService.subscribeToVendorDeliveries(user.id, () => {
      deliveryService.getVendorDeliveries(user.id)
        .then((updatedDeliveries) => setDeliveries(updatedDeliveries))
        .catch((err) => console.warn('Realtime vendor update error:', err));
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  const handleRetry = () => {
    if (!user?.id) return;
    setIsLoading(true);
    setLoadError(null);

    Promise.all([
      logisticsService.getVendorProfile(user.id),
      deliveryService.getVendorDeliveries(user.id),
    ])
      .then(([prof, userDeliveries]) => {
        setProfile(prof);
        setDeliveries(userDeliveries);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to connect to deliveries database.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_transit' | 'delivered'>('all');

  const humanizeStatus = (status: string): string => {
    switch (status) {
      case 'opportunity_sent': return 'Dispatching';
      case 'searching': return 'Searching';
      case 'provider_selected': return 'Provider Matched';
      case 'awaiting_pickup': return 'Awaiting Pickup';
      case 'in_transit': return 'In Transit';
      case 'delivered': return 'Delivered';
      case 'created': return 'Created';
      default: return status.replace(/_/g, ' ');
    }
  };

  const filteredDeliveries = deliveries.filter((d) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      d.id.toLowerCase().includes(query) ||
      d.productName.toLowerCase().includes(query) ||
      d.recipient.name.toLowerCase().includes(query) ||
      d.destination.city.toLowerCase().includes(query);

    let matchesStatus = true;
    if (statusFilter === 'pending') {
      matchesStatus = d.status === 'created' || d.status === 'searching' || d.status === 'opportunity_sent' || d.status === 'awaiting_pickup' || d.status === 'provider_selected';
    } else if (statusFilter === 'in_transit') {
      matchesStatus = d.status === 'in_transit';
    } else if (statusFilter === 'delivered') {
      matchesStatus = d.status === 'delivered';
    }

    return matchesQuery && matchesStatus;
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const pendingCount = deliveries.filter((d) => d.status === 'awaiting_pickup' || d.status === 'searching' || d.status === 'opportunity_sent' || d.status === 'provider_selected').length;
  const inTransitCount = deliveries.filter((d) => d.status === 'in_transit').length;
  const deliveredCount = deliveries.filter((d) => d.status === 'delivered').length;

  return (
    <div className="of-dashboard-layout">
      {/* Header */}
      <div className="of-dashboard-header">
        <div className="of-dashboard-title-group">
          <div className="of-dashboard-title-row">
            <h1 className="of-dashboard-h1">Vendor Workspace</h1>
            <Badge variant="brand">Vendor</Badge>
          </div>
          <p className="of-dashboard-subtitle">
            Manage your delivery dispatches and connect with verified logistics providers.
          </p>
        </div>

        <div className="of-dashboard-actions">
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/vendor/deliveries/create')}
            leftIcon={<Plus size={16} />}
          >
            Create Delivery
          </Button>

          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut size={15} />
            Sign out
          </Button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            color: '#DC2626',
            fontSize: 'var(--font-size-sm)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AlertCircle size={18} />
            <span>{loadError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleRetry} disabled={isLoading}>
            Retry
          </Button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="of-metrics-grid">
        <div className="of-metric-card">
          <div className="of-metric-header">
            <span className="of-metric-label">Total Requests</span>
            <Package size={18} color="var(--color-brand-accent)" />
          </div>
          <p className="of-metric-value">{deliveries.length}</p>
          <span className="of-metric-subtext">All time volume</span>
        </div>

        <div className="of-metric-card">
          <div className="of-metric-header">
            <span className="of-metric-label">Pending Dispatch</span>
            <Clock size={18} color="#D97706" />
          </div>
          <p className="of-metric-value">{pendingCount}</p>
          <span className="of-metric-subtext">Awaiting pickup/match</span>
        </div>

        <div className="of-metric-card">
          <div className="of-metric-header">
            <span className="of-metric-label">In Transit</span>
            <Truck size={18} color="var(--color-brand-accent)" />
          </div>
          <p className="of-metric-value">{inTransitCount}</p>
          <span className="of-metric-subtext">Live on road</span>
        </div>

        <div className="of-metric-card">
          <div className="of-metric-header">
            <span className="of-metric-label">Delivered</span>
            <CheckCircle2 size={18} color="#16A34A" />
          </div>
          <p className="of-metric-value">{deliveredCount}</p>
          <span className="of-metric-subtext">Completed orders</span>
        </div>
      </div>

      {/* Content Grid */}
      <div className="of-dashboard-grid">
        {/* Deliveries Panel */}
        <div className="of-panel">
          <div className="of-panel-header">
            <div>
              <h2 className="of-panel-title">Deliveries Directory</h2>
              <span className="of-panel-subtitle">
                Track active requests, dispatches, and status updates
              </span>
            </div>

            <Button variant="primary" size="sm" onClick={() => navigate('/vendor/deliveries/create')} leftIcon={<Plus size={15} />}>
              Create Delivery
            </Button>
          </div>

          {/* Filter Bar */}
          <div className="of-filter-bar">
            <div className="of-filter-input" style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search by ID, product, or recipient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="of-input"
                style={{ height: '38px', paddingLeft: '34px' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '11px', top: '12px', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
            </div>

            <div className="of-filter-pills">
              {(['all', 'pending', 'in_transit', 'delivered'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setStatusFilter(filterKey)}
                  className={`of-filter-pill ${statusFilter === filterKey ? 'is-active' : ''}`}
                >
                  {filterKey === 'pending' ? 'In Progress' : filterKey.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Deliveries List */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <Clock size={32} color="var(--color-brand-accent)" style={{ marginBottom: '12px', animation: 'spin 2s linear infinite' }} />
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
                Loading your delivery dispatches...
              </p>
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Package size={32} color="var(--color-text-muted)" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                No matching deliveries found
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                {searchQuery ? 'Try clearing your search terms or filter selection.' : 'Create your first delivery request to get started.'}
              </p>
              {!searchQuery && (
                <Button variant="primary" size="sm" onClick={() => navigate('/vendor/deliveries/create')}>
                  Create First Delivery
                </Button>
              )}
            </div>
          ) : (
            <div className="of-delivery-list">
              {filteredDeliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  onClick={() => navigate(`/vendor/deliveries/${delivery.id}`)}
                  className="of-delivery-row"
                >
                  <div className="of-delivery-meta">
                    <div className="of-delivery-icon-box">
                      <Package size={18} />
                    </div>
                    <div className="of-delivery-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12px', color: 'var(--color-brand-accent)' }}>
                          {delivery.trackingCode || delivery.id}
                        </span>
                        <span className="of-delivery-item-name">
                          {delivery.productName}
                        </span>
                      </div>
                      <span className="of-delivery-sub-info">
                        {delivery.pickup.city} → {delivery.destination.city} • Partner:{' '}
                        <strong style={{ color: 'var(--color-text-primary)' }}>
                          {delivery.selectedProvider?.name
                            ? delivery.selectedProvider.name
                            : delivery.status === 'opportunity_sent'
                            ? 'Dispatching...'
                            : delivery.status === 'searching'
                            ? 'Searching...'
                            : 'Unassigned'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="of-delivery-status-col">
                    <div style={{ textAlign: 'right' }}>
                      <p className="of-delivery-price" style={{ margin: 0 }}>
                        ₦{delivery.estimatedPrice.toLocaleString()}
                      </p>
                      <Badge
                        variant={
                          delivery.status === 'delivered'
                            ? 'success'
                            : delivery.status === 'in_transit'
                            ? 'brand'
                            : delivery.status === 'provider_selected' || delivery.status === 'awaiting_pickup'
                            ? 'info'
                            : delivery.status === 'opportunity_sent' || delivery.status === 'searching'
                            ? 'warning'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {humanizeStatus(delivery.status)}
                      </Badge>
                    </div>

                    <ChevronRight size={16} color="var(--color-text-muted)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Business Profile Side Panel */}
        <div className="of-panel" style={{ height: 'fit-content' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={18} color="var(--color-brand-accent)" />
            Business Profile
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Business Name
              </span>
              <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {profile?.businessName || user?.fullName || 'Commercial Vendor'}
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Category
              </span>
              <p style={{ color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {profile?.businessCategory || 'Commerce & Goods'}
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Operating City
              </span>
              <p style={{ color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {profile?.operatingCity || 'Ibadan'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
