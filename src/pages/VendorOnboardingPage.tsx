import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, AlertCircle } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../auth/AuthContext';

export const VendorOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { completeVendorOnboarding, user } = useAuth();

  const [formData, setFormData] = useState({
    businessName: '',
    businessCategory: '',
    operatingCity: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.businessName.trim()) errs.businessName = 'Business name is required.';
    if (!formData.businessCategory.trim()) errs.businessCategory = 'Category is required.';
    if (!formData.operatingCity.trim()) errs.operatingCity = 'Operating city is required.';
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
    const { error } = await completeVendorOnboarding({
      profile: {
        businessName: formData.businessName,
        businessCategory: formData.businessCategory,
        operatingCity: formData.operatingCity,
      },
    });
    setIsSubmitting(false);
    if (error) {
      setApiError(error.message);
      return;
    }
    // On success, go to vendor dashboard app route
    navigate('/vendor/dashboard', { replace: true });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <AuthLayout backLink={{ to: '/role-selection', label: 'Back to role selection' }}>
      <h1 className="of-auth-heading">Vendor onboarding</h1>
      <p className="of-auth-subheading">
        Tell us about your business so we can match you with the right logistics providers.
      </p>

      {apiError && (
        <div className="of-auth-error-banner" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{apiError}</span>
        </div>
      )}

      <form className="of-auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="Business name"
          type="text"
          placeholder="Acme Corp"
          value={formData.businessName}
          onChange={e => handleChange('businessName', e.target.value)}
          error={errors.businessName}
          leftIcon={<Building2 size={16} />}
        />
        <Input
          label="Category"
          type="text"
          placeholder="Retail, Electronics, Food …"
          value={formData.businessCategory}
          onChange={e => handleChange('businessCategory', e.target.value)}
          error={errors.businessCategory}
        />
        <Input
          label="Operating city"
          type="text"
          placeholder="San Francisco, CA"
          value={formData.operatingCity}
          onChange={e => handleChange('operatingCity', e.target.value)}
          error={errors.operatingCity}
        />
        <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
          Finish onboarding
        </Button>
      </form>
    </AuthLayout>
  );
};
