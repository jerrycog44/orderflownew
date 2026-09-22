import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, LogOut, MapPin, Navigation, ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { deliveryService } from '../services/deliveryService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { LogisticsProviderProfile, DeliveryRecord } from '../types';

export const ProviderDashboardPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Lazy initialize profile
  const [profile] = useState<LogisticsProviderProfile | null>(() => {
    if (user?.id) {
      try {
        const raw = localStorage.getItem('of_dev_provider_profiles');
        if (raw) {
          const profiles: Record<string, LogisticsProviderProfile> = JSON.parse(raw);
          return profiles[user.id] || null;
        }
      } catch {
        // ignore parse error
      }
    }
    return null;
  });

  // Lazy initialize opportunities
  const [opportunities] = useState<DeliveryRecord[]>(() => {
    return deliveryService.getProviderOpportunities(profile?.coverageArea);
  });

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

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
              Logistics Provider Dashboard
            </h1>
            <Badge variant="brand">Logistics Provider</Badge>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Welcome back, <strong>{user?.fullName || 'Provider'}</strong>. Manage your fleet services and browse delivery opportunities.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut size={16} style={{ marginRight: '6px' }} />
          Sign out
        </Button>
      </div>

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.5fr) minmax(280px, 1fr)', gap: 'var(--space-6)' }}>
        {/* Delivery Opportunities Section */}
        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                Delivery Opportunities
              </h2>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Available vendor delivery requests matching your service area
              </span>
            </div>
            <Badge variant="success">{opportunities.length} Available</Badge>
          </div>

          {opportunities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
              <Truck size={36} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-2)' }} />
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                No active delivery requests right now
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                New vendor requests in your coverage area will appear here automatically.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  style={{
                    background: 'var(--color-bg-subtle)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '2px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-accent)' }}>
                          {opp.id}
                        </span>
                        <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                          {opp.productName}
                        </h3>
                      </div>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        Vendor: {opp.vendorName} • {opp.package.weightKg} kg ({opp.package.packageType})
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Est. Payout
                      </span>
                      <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: '#10B981', margin: 0 }}>
                        ₦{opp.estimatedPrice.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)', background: 'var(--color-bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} color="var(--color-brand-accent)" />
                      <span><strong>Pickup:</strong> {opp.pickup.address} ({opp.pickup.city})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Navigation size={14} color="#10B981" />
                      <span><strong>Dropoff:</strong> {opp.destination.address} ({opp.destination.city})</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => alert(`Delivery Request ${opp.id}: Payout ₦${opp.estimatedPrice.toLocaleString()} for pickup at ${opp.pickup.address}. Job dispatch feature activating in full launch.`)}
                      rightIcon={<ArrowRight size={14} />}
                    >
                      View Request
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Provider Profile Details Card */}
        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Truck size={18} color="var(--color-brand-accent)" />
            Service Profile
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Company / Service Name
              </span>
              <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {profile?.providerName || 'SwiftHaul Express'}
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Type & Availability
              </span>
              <p style={{ color: 'var(--color-text-primary)', margin: '2px 0 0 0', textTransform: 'capitalize' }}>
                {profile?.providerType || 'courier'} • <span style={{ color: '#10B981', fontWeight: 600 }}>Available</span>
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Coverage Area
              </span>
              <p style={{ color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {profile?.coverageArea || 'Ibadan'}
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Fleet Vehicles
              </span>
              <p style={{ color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {profile?.vehicleTypes && profile.vehicleTypes.length > 0 ? profile.vehicleTypes.join(', ') : 'Motorcycle, Delivery Van'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
