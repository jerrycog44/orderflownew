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

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.providerName.trim()) errs.providerName = 'Provider name is required.';
    if (!formData.providerType.trim()) errs.providerType = 'Provider type is required.';
    if (!formData.coverageArea.trim()) errs.coverageArea = 'Coverage area is required.';
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
        vehicleTypes: formData.vehicleTypes.split(',').map(v => v.trim()).filter(Boolean),
        packageCategories: formData.packageCategories.split(',').map(v => v.trim()).filter(Boolean),
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
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <AuthLayout backLink={{ to: '/role-selection', label: 'Back to role selection' }}>
      <h1 className="of-auth-heading">Logistics Provider onboarding</h1>
      <p className="of-auth-subheading">
        Provide key details about your service so vendors can find you.
      </p>

      {apiError && (
        <div className="of-auth-error-banner" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{apiError}</span>
        </div>
      )}

      <form className="of-auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="Provider name"
          type="text"
          placeholder="FastShip Logistics"
          value={formData.providerName}
          onChange={e => handleChange('providerName', e.target.value)}
          error={errors.providerName}
          leftIcon={<Truck size={16} />}
        />
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label className="of-form-label" htmlFor="providerType">
            Provider type
          </label>
          <select
            id="providerType"
            value={formData.providerType}
            onChange={e => handleChange('providerType', e.target.value)}
            className="of-input"
          >
            <option value="courier">Courier</option>
            <option value="freight">Freight</option>
            <option value="van">Van Service</option>
            <option value="motorcycle">Motorcycle Rider</option>
            <option value="mixed">Mixed Fleet</option>
          </select>
        </div>
        <Input
          label="Coverage area"
          type="text"
          placeholder="Los Angeles, CA; Nationwide"
          value={formData.coverageArea}
          onChange={e => handleChange('coverageArea', e.target.value)}
          error={errors.coverageArea}
        />
        <Input
          label="Vehicle types (comma separated)"
          type="text"
          placeholder="Van, Motorcycle, Truck"
          value={formData.vehicleTypes}
          onChange={e => handleChange('vehicleTypes', e.target.value)}
        />
        <Input
          label="Package categories (comma separated)"
          type="text"
          placeholder="Electronics, Clothing, Fragile"
          value={formData.packageCategories}
          onChange={e => handleChange('packageCategories', e.target.value)}
        />
        <div style={{ marginTop: 'var(--space-3)' }}>
          <label className="of-form-label" htmlFor="availability">
            Availability
          </label>
          <select
            id="availability"
            value={formData.availability}
            onChange={e => handleChange('availability', e.target.value)}
            className="of-input"
          >
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
        <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
          Finish onboarding
        </Button>
      </form>
    </AuthLayout>
  );
};
