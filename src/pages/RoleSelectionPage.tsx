import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Truck, ArrowRight, AlertCircle } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Button } from '../components/ui/Button';
import { useAuth } from '../auth/AuthContext';
import type { UserRole } from '../types';

export const RoleSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setRole, user } = useAuth();

  const hintedRole = searchParams.get('role') as UserRole | null;
  const [selected, setSelected] = useState<UserRole | null>(
    hintedRole === 'vendor' || hintedRole === 'logistics_provider' ? hintedRole : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    setError(null);

    const { error: authError } = await setRole(selected);
    setIsSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    navigate(selected === 'vendor' ? '/onboarding/vendor' : '/onboarding/provider', { replace: true });
  };

  const roles: { value: UserRole; icon: React.ReactNode; title: string; description: string; detail: string }[] = [
    {
      value: 'vendor',
      icon: <Building2 size={28} />,
      title: 'Vendor',
      description: 'I need to deliver products to customers.',
      detail: 'Create delivery requests, compare logistics options, book providers, and track your orders.',
    },
    {
      value: 'logistics_provider',
      icon: <Truck size={28} />,
      title: 'Logistics Provider',
      description: 'I provide delivery and transport services.',
      detail: 'Receive and fulfill delivery requests from vendors. Manage your fleet and service operations.',
    },
  ];

  return (
    <AuthLayout>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        {user?.fullName && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
            Welcome, <strong style={{ color: 'var(--color-text-primary)' }}>{user.fullName}</strong>
          </p>
        )}
        <h1 className="of-auth-heading">How will you use OrderFlow?</h1>
        <p className="of-auth-subheading">
          This determines your experience. You can only set this once.
        </p>
      </div>

      {error && (
        <div className="of-auth-error-banner" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="of-role-cards">
        {roles.map((role) => (
          <button
            key={role.value}
            type="button"
            className={`of-role-card ${selected === role.value ? 'is-selected' : ''}`}
            onClick={() => setSelected(role.value)}
            aria-pressed={selected === role.value}
          >
            <div className="of-role-card-header">
              <div className="of-role-icon-box">{role.icon}</div>
              <div className={`of-role-check ${selected === role.value ? 'is-checked' : ''}`}>
                {selected === role.value && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
            <h3 className="of-role-title">{role.title}</h3>
            <p className="of-role-desc">{role.description}</p>
            <p className="of-role-detail">{role.detail}</p>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 'var(--space-6)' }}>
        <Button
          variant="primary"
          size="lg"
          disabled={!selected}
          isLoading={isSubmitting}
          onClick={handleContinue}
          rightIcon={<ArrowRight size={18} />}
          className="of-auth-submit-btn"
        >
          Continue as {selected === 'vendor' ? 'Vendor' : selected === 'logistics_provider' ? 'Logistics Provider' : '...'}
        </Button>
      </div>
    </AuthLayout>
  );
};
