import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, Package, Truck, Clock, CheckCircle2, Building, ChevronRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { deliveryService } from '../services/deliveryService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { VendorProfile, DeliveryRecord } from '../types';

export const VendorDashboardPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Lazy initialize profile from local storage
  const [profile] = useState<VendorProfile | null>(() => {
    if (user?.id) {
      try {
        const raw = localStorage.getItem('of_dev_vendor_profiles');
        if (raw) {
          const profiles: Record<string, VendorProfile> = JSON.parse(raw);
          return profiles[user.id] || null;
        }
      } catch {
        // ignore parse error
      }
    }
    return null;
  });

  // Lazy initialize vendor deliveries
  const [deliveries] = useState<DeliveryRecord[]>(() => {
    if (user?.id) {
      return deliveryService.getVendorDeliveries(user.id);
    }
    return deliveryService.getVendorDeliveries('mock_vendor_1');
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_transit' | 'delivered'>('all');

  const filteredDeliveries = deliveries.filter((d) => {
    // Search matching
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      d.id.toLowerCase().includes(query) ||
      d.productName.toLowerCase().includes(query) ||
      d.recipient.name.toLowerCase().includes(query) ||
      d.destination.city.toLowerCase().includes(query);

    // Filter matching
    let matchesStatus = true;
    if (statusFilter === 'pending') {
      matchesStatus = d.status === 'created' || d.status === 'searching' || d.status === 'awaiting_pickup' || d.status === 'provider_selected';
    } else if (statusFilter === 'in_transit') {
      matchesStatus = d.status === 'in_transit';
    } else if (statusFilter === 'delivered') {
      matchesStatus = d.status === 'delivered';
    }

    return matchesQuery && matchesStatus;
  });

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  const pendingCount = deliveries.filter((d) => d.status === 'awaiting_pickup' || d.status === 'searching' || d.status === 'provider_selected').length;
  const inTransitCount = deliveries.filter((d) => d.status === 'in_transit').length;
  const deliveredCount = deliveries.filter((d) => d.status === 'delivered').length;

  return (
    <div style={{ maxWidth: '1140px', margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
      {/* Top Banner Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)',
          paddingBottom: 'var(--space-6)',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Vendor Dashboard
            </h1>
            <Badge variant="brand">Vendor</Badge>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Welcome back, <strong>{user?.fullName || 'Vendor'}</strong>. Manage your deliveries and request logistics providers.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/vendor/deliveries/create')}
            leftIcon={<Plus size={18} />}
          >
            Create Delivery
          </Button>

          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut size={16} style={{ marginRight: '6px' }} />
            Sign out
          </Button>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)',
        }}
      >
        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Deliveries
            </span>
            <Package size={20} color="var(--color-brand-accent)" />
          </div>
          <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            {deliveries.length}
          </p>
        </div>

        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pending Dispatch
            </span>
            <Clock size={20} color="#F59E0B" />
          </div>
          <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            {pendingCount}
          </p>
        </div>

        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              In Transit
            </span>
            <Truck size={20} color="var(--color-brand-accent)" />
          </div>
          <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            {inTransitCount}
          </p>
        </div>

        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Delivered
            </span>
            <CheckCircle2 size={20} color="#10B981" />
          </div>
          <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            {deliveredCount}
          </p>
        </div>
      </div>

      {/* Main Grid: Deliveries Table vs Profile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.5fr) minmax(280px, 1fr)', gap: 'var(--space-6)' }}>
        {/* Deliveries List */}
        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                Deliveries Management
              </h2>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Track active requests, provider dispatches, and order statuses
              </span>
            </div>

            <Button variant="primary" size="sm" onClick={() => navigate('/vendor/deliveries/create')} leftIcon={<Plus size={16} />}>
              Create Delivery
            </Button>
          </div>

          {/* Search & Filter Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', alignItems: 'center' }}>
            <div style={{ flex: '1', minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search by ID, item name, or recipient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--font-size-sm)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  background: 'var(--color-bg-subtle)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
              {(['all', 'pending', 'in_transit', 'delivered'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setStatusFilter(filterKey)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    background: statusFilter === filterKey ? 'var(--color-brand-primary)' : 'transparent',
                    color: statusFilter === filterKey ? '#ffffff' : 'var(--color-text-secondary)',
                    borderColor: statusFilter === filterKey ? 'var(--color-brand-primary)' : 'var(--color-border-default)',
                    textTransform: 'capitalize',
                  }}
                >
                  {filterKey.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {filteredDeliveries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
              <Package size={36} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-2)' }} />
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                No matching deliveries found
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                {searchQuery ? 'Try clearing your search terms or filter selection.' : 'Create your first delivery request to get started.'}
              </p>
              {!searchQuery && (
                <Button variant="primary" onClick={() => navigate('/vendor/deliveries/create')}>
                  Create First Delivery
                </Button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {filteredDeliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  onClick={() => navigate(`/vendor/deliveries/${delivery.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-4)',
                    background: 'var(--color-bg-subtle)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'border-color var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-brand-accent-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-brand-accent)',
                      }}
                    >
                      <Package size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-accent)' }}>
                          {delivery.id}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                          {delivery.productName}
                        </span>
                      </div>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {delivery.pickup.city} → {delivery.destination.city} • Partner: <strong>{delivery.selectedProvider?.name || 'Searching'}</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', margin: 0 }}>
                        ₦{delivery.estimatedPrice.toLocaleString()}
                      </p>
                      <Badge variant={delivery.status === 'delivered' ? 'success' : delivery.status === 'in_transit' ? 'brand' : 'neutral'}>
                        {delivery.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <ChevronRight size={18} color="var(--color-text-tertiary)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profile Card */}
        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Building size={18} color="var(--color-brand-accent)" />
            Business Profile
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Business Name
              </span>
              <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {profile?.businessName || 'Apex Fashion Hub'}
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Category
              </span>
              <p style={{ color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {profile?.businessCategory || 'Fashion & Apparel'}
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
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
