import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, CheckCircle2, Building } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { VendorProfile } from '../types';

export const VendorDashboardPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<VendorProfile | null>(null);

  useEffect(() => {
    if (user?.id) {
      try {
        const raw = localStorage.getItem('of_dev_vendor_profiles');
        if (raw) {
          const profiles: Record<string, VendorProfile> = JSON.parse(raw);
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
              Vendor Dashboard
            </h1>
            <Badge variant="brand">Vendor</Badge>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Welcome back, {user?.fullName || 'Vendor'}. Manage your delivery requests and view matching logistics providers.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut size={16} style={{ marginRight: '6px' }} />
          Sign out
        </Button>
      </div>

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Profile Details Card */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}
        >
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Building size={20} color="var(--color-brand)" />
            Business Profile
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Business Name
              </span>
              <p style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {profile?.businessName || 'Not specified'}
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Category
              </span>
              <p style={{ color: 'var(--color-text-primary)' }}>
                {profile?.businessCategory || 'Not specified'}
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Operating City
              </span>
              <p style={{ color: 'var(--color-text-primary)' }}>
                {profile?.operatingCity || 'Not specified'}
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Account Email / Phone
              </span>
              <p style={{ color: 'var(--color-text-primary)' }}>
                {user?.email} • {user?.phone}
              </p>
            </div>
          </div>
        </div>

        {/* Deliveries & Marketplace Card */}
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
              Your vendor account is active. Delivery request creation, automated logistics quote comparison, and live shipment tracking features will be enabled in Phase 3.
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
                Phase 3: Logistics Marketplace
              </span>
              <Badge variant="neutral">Coming Soon</Badge>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
              Create delivery requests, specify package dimensions, select rates from verified providers, and track deliveries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
