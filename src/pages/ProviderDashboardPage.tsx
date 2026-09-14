import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { LogisticsProviderProfile } from '../types';

export const ProviderDashboardPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<LogisticsProviderProfile | null>(null);

  useEffect(() => {
    if (user?.id) {
      try {
        const raw = localStorage.getItem('of_dev_provider_profiles');
        if (raw) {
          const profiles: Record<string, LogisticsProviderProfile> = JSON.parse(raw);
          if (profiles[user.id]) {
            setProfile(profiles[user.id]);
          }
        }
      } catch {
        // ignore parse error
      }
    }
  }, [user]);

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
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
          borderBottom: '1px solid var(--color-border)',
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
            Welcome back, {user?.fullName || 'Provider'}. Manage your fleet services, view delivery jobs, and set rates.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut size={16} style={{ marginRight: '6px' }} />
          Sign out
        </Button>
      </div>

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Logistics Service Details Card */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}
        >
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Truck size={20} color="var(--color-brand)" />
            Service Profile
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Company / Service Name
              </span>
              <p style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {profile?.providerName || 'Not specified'}
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Type & Availability
              </span>
              <p style={{ color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
                {profile?.providerType || 'Courier'} • <span style={{ color: profile?.availability === 'available' ? 'var(--color-success)' : 'var(--color-warning)' }}>{profile?.availability || 'Available'}</span>
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Coverage Area
              </span>
              <p style={{ color: 'var(--color-text-primary)' }}>
                {profile?.coverageArea || 'Not specified'}
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Fleet / Vehicles
              </span>
              <p style={{ color: 'var(--color-text-primary)' }}>
                {profile?.vehicleTypes && profile.vehicleTypes.length > 0 ? profile.vehicleTypes.join(', ') : 'Not specified'}
              </p>
            </div>
          </div>
        </div>

        {/* Dispatch & Dispatch Management Card */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <CheckCircle2 size={20} color="var(--color-success)" />
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>Onboarding Complete</h2>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: '1.6', marginBottom: 'var(--space-4)' }}>
              Your provider profile is listed on OrderFlow. Active job notifications, rate card management, and driver assignment workflows will be activated in Phase 3.
            </p>
          </div>

          <div
            style={{
              padding: 'var(--space-4)',
              background: 'var(--color-surface-hover)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--color-border-hover)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                Phase 3: Delivery Management
              </span>
              <Badge variant="neutral">Coming Soon</Badge>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
              Receive delivery requests from vendors, accept pickup jobs, update dispatch status, and manage proof of delivery.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
