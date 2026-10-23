import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, AlertCircle } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../auth/AuthContext';

export const ProviderOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { completeProviderOnboarding, user } = useAuth();

  const [formData, setFormData] = useState({
    providerName: '',
    providerType: 'courier',
    coverageArea: '',
    vehicleTypes: '', // comma separated list
    packageCategories: '', // comma separated list
    availability: 'available',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [selectedVehicles, setSelectedVehicles] = useState<string[]>(['Motorcycle', 'Delivery Van']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Fashion & Apparel',
    'Electronics & Luxury',
    'Food & Groceries',
  ]);

  const toggleVehicle = (v: string) => {
    setSelectedVehicles((prev) =>
      prev.includes(v) ? prev.filter((item) => item !== v) : [...prev, v]
    );
  };

  const toggleCategory = (c: string) => {
    setSelectedCategories((prev) =>
      prev.includes(c) ? prev.filter((item) => item !== c) : [...prev, c]
    );
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.providerName.trim()) errs.providerName = 'Provider name is required.';
    if (!formData.providerType.trim()) errs.providerType = 'Provider type is required.';
    if (!formData.coverageArea.trim()) errs.coverageArea = 'Coverage area is required.';
    if (selectedVehicles.length === 0) errs.vehicles = 'Please select at least one vehicle type.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;
    if (!user) {
      setApiError('User session missing. Please sign in again.');
      return;
    }
    setIsSubmitting(true);
    const { error } = await completeProviderOnboarding({
      profile: {
        providerName: formData.providerName,
        providerType: (formData.providerType as 'courier' | 'freight' | 'van' | 'motorcycle' | 'mixed') || 'courier',
        coverageArea: formData.coverageArea,
        vehicleTypes: selectedVehicles,
        packageCategories: selectedCategories,
        availability: formData.availability as 'available' | 'unavailable',
      },
    });
    setIsSubmitting(false);
    if (error) {
      setApiError(error.message);
      return;
    }
    // On success, go to logistics dashboard app route
    navigate('/logistics/dashboard', { replace: true });
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const VEHICLE_OPTIONS = ['Motorcycle', 'Delivery Van', 'Cargo Truck', 'Bicycle / E-bike'];
  const CATEGORY_OPTIONS = [
    'Fashion & Apparel',
    'Electronics & Luxury',
    'Food & Groceries',
    'Healthcare & Beauty',
    'Documents & Parcels',
  ];

  return (
    <AuthLayout backLink={{ to: '/role-selection', label: 'Back to role selection' }}>
      <h1 className="of-auth-heading">Logistics Provider Onboarding</h1>
      <p className="of-auth-subheading">
        Provide key details about your fleet service so commercial vendors can route dispatches to you.
      </p>

      {apiError && (
        <div className="of-auth-error-banner" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{apiError}</span>
        </div>
      )}

      <form className="of-auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="Provider / Fleet Company Name"
          type="text"
          placeholder="e.g. SwiftHaul Express"
          value={formData.providerName}
          onChange={(e) => handleChange('providerName', e.target.value)}
          error={errors.providerName}
          leftIcon={<Truck size={16} />}
        />

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label className="of-form-label" htmlFor="providerType">
            Provider Type
          </label>
          <select
            id="providerType"
            value={formData.providerType}
            onChange={(e) => handleChange('providerType', e.target.value)}
            className="of-input"
          >
            <option value="courier">Courier (Last-mile Dispatch)</option>
            <option value="freight">Freight & Heavy Haulage</option>
            <option value="van">Van Delivery Fleet</option>
            <option value="motorcycle">Motorcycle Dispatch Network</option>
            <option value="mixed">Mixed Multimodal Fleet</option>
          </select>
        </div>

        <Input
          label="Primary Service Coverage Territory"
          type="text"
          placeholder="e.g. Ibadan (Bodija, Ring Road, Dugbe) or Lagos (Ikeja, Island)"
          value={formData.coverageArea}
          onChange={(e) => handleChange('coverageArea', e.target.value)}
          error={errors.coverageArea}
        />

        {/* Interactive Vehicle Chips */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label className="of-form-label">
            Fleet Vehicle Types {errors.vehicles && <span style={{ color: '#DC2626', fontSize: '11px' }}>({errors.vehicles})</span>}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {VEHICLE_OPTIONS.map((v) => {
              const isSelected = selectedVehicles.includes(v);
              return (
                <button
                  type="button"
                  key={v}
                  onClick={() => toggleVehicle(v)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: isSelected
                      ? '1px solid var(--color-brand-accent)'
                      : '1px solid var(--color-border-default)',
                    background: isSelected
                      ? 'var(--color-brand-accent-light)'
                      : 'var(--color-bg-subtle)',
                    color: isSelected
                      ? 'var(--color-brand-accent)'
                      : 'var(--color-text-secondary)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {isSelected ? '✓ ' : '+ '}{v}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Category Chips */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label className="of-form-label">Supported Package Categories</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {CATEGORY_OPTIONS.map((c) => {
              const isSelected = selectedCategories.includes(c);
              return (
                <button
                  type="button"
                  key={c}
                  onClick={() => toggleCategory(c)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: isSelected
                      ? '1px solid #10B981'
                      : '1px solid var(--color-border-default)',
                    background: isSelected ? '#ECFDF5' : 'var(--color-bg-subtle)',
                    color: isSelected ? '#047857' : 'var(--color-text-secondary)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {isSelected ? '✓ ' : '+ '}{c}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-3)' }}>
          <label className="of-form-label" htmlFor="availability">
            Initial Availability Status
          </label>
          <select
            id="availability"
            value={formData.availability}
            onChange={(e) => handleChange('availability', e.target.value)}
            className="of-input"
          >
            <option value="available">Online (Ready to receive dispatches)</option>
            <option value="unavailable">Offline (Set available later)</option>
          </select>
        </div>

        <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
          Finish Onboarding
        </Button>
      </form>
    </AuthLayout>
  );
};
