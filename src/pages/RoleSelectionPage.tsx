import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Store, Truck, ArrowRight, AlertCircle, Check } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Button } from '../components/ui/Button';
import { useAuth } from '../auth/AuthContext';
import type { UserRole } from '../types';
import './RoleSelectionPage.css';

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

  const roles: { value: UserRole; icon: React.ReactNode; title: string; description: string }[] = [
    {
      value: 'vendor',
      icon: <Store size={20} />,
      title: 'Vendor',
      description: 'Deliver products to your customers.',
    },
    {
      value: 'logistics_provider',
      icon: <Truck size={20} />,
      title: 'Logistics Provider',
      description: 'Manage deliveries and serve vendors.',
    },
  ];

  return (
    <AuthLayout maxWidth="560px">
      <div className="of-role-selection-wrapper">
        <div className="of-role-header">
          {user?.fullName && (
            <div className="of-role-welcome-badge">
              Welcome, {user.fullName}
            </div>
          )}
          <h1 className="of-role-title">How will you use OrderFlow?</h1>
          <p className="of-role-subtitle">
            Choose the workspace that fits you.
          </p>
        </div>

        {error && (
          <div className="of-auth-error-banner" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div className="of-role-grid" role="radiogroup" aria-label="OrderFlow Role Selection">
          {roles.map((role) => {
            const isSelected = selected === role.value;
            return (
              <button
                key={role.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                className={`of-role-card ${isSelected ? 'is-selected' : ''}`}
                onClick={() => setSelected(role.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(role.value);
                  }
                }}
              >
                <div className="of-role-card-top">
                  <div className="of-role-icon-box">{role.icon}</div>
                  <div className="of-role-check-ring">
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                </div>

                <div className="of-role-card-body">
                  <h2 className="of-role-card-title">{role.title}</h2>
                  <p className="of-role-card-desc">{role.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="of-role-footer">
          <Button
            variant="primary"
            size="lg"
            disabled={!selected}
            isLoading={isSubmitting}
            onClick={handleContinue}
            rightIcon={selected ? <ArrowRight size={18} /> : undefined}
            className="of-role-cta-btn"
          >
            {selected ? 'Continue' : 'Select a role'}
          </Button>

          <p className="of-role-note">
            You can update your workspace preferences anytime in settings.
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};
