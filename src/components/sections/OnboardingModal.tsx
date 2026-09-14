import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { CheckCircle2, Building2, Truck, ArrowRight } from 'lucide-react';
import { useToast } from '../ui/Toast';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: 'vendor' | 'logistics_provider';
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  defaultRole = 'vendor',
}) => {
  const { addToast } = useToast();
  const [role, setRole] = useState<'vendor' | 'logistics_provider'>(defaultRole);
  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    industryOrFleet: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleRoleChange = (newRole: 'vendor' | 'logistics_provider') => {
    setRole(newRole);
    setErrors({});
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.businessName.trim()) {
      errs.businessName = 'Business name is required';
    }
    if (!formData.contactName.trim()) {
      errs.contactName = 'Contact name is required';
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      errs.email = 'Please enter a valid work email address';
    }
    if (!formData.phone.trim()) {
      errs.phone = 'Phone number is required for dispatch verification';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      addToast({
        title: role === 'vendor' ? 'Vendor Registration Submitted' : 'Logistics Partner Application Received',
        description: 'Your account profile preview has been created for the upcoming dashboard release.',
        type: 'success',
      });
    }, 1000);
  };

  const handleReset = () => {
    setIsSuccess(false);
    setFormData({
      businessName: '',
      contactName: '',
      email: '',
      phone: '',
      industryOrFleet: '',
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title={isSuccess ? 'Registration Received' : 'Get Started with OrderFlow'}
      description={
        isSuccess
          ? 'Your business profile foundation has been initialized.'
          : 'Select your account type to access the OrderFlow logistics platform.'
      }
      maxWidth="md"
    >
      {isSuccess ? (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-status-success-bg)',
              color: 'var(--color-status-success-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
            }}
          >
            <CheckCircle2 size={32} />
          </div>
          <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
            {role === 'vendor' ? 'Welcome to OrderFlow Vendor Core' : 'Welcome to OrderFlow Logistics Partner Hub'}
          </h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Thank you, <strong>{formData.contactName}</strong>. Your profile for <strong>{formData.businessName}</strong> has been created. In future phases, you will access your dispatch dashboard directly here.
          </p>
          <Button variant="primary" size="md" onClick={handleReset} style={{ margin: '0 auto' }}>
            Done & Return to Overview
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Account Role Selector */}
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-primary)', display: 'block', marginBottom: '0.5rem' }}>
              I am joining OrderFlow as a:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => handleRoleChange('vendor')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${role === 'vendor' ? 'var(--color-brand-accent)' : 'var(--color-border-default)'}`,
                  backgroundColor: role === 'vendor' ? 'var(--color-brand-accent-light)' : 'var(--color-bg-surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Building2 size={20} color={role === 'vendor' ? 'var(--color-brand-accent)' : '#64748B'} />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Commercial Vendor</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Need to ship products</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('logistics_provider')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${role === 'logistics_provider' ? 'var(--color-brand-accent)' : 'var(--color-border-default)'}`,
                  backgroundColor: role === 'logistics_provider' ? 'var(--color-brand-accent-light)' : 'var(--color-bg-surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Truck size={20} color={role === 'logistics_provider' ? 'var(--color-brand-accent)' : '#64748B'} />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Logistics Company</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Provide delivery fleets</div>
                </div>
              </button>
            </div>
          </div>

          <Input
            label="Company / Business Name"
            placeholder={role === 'vendor' ? 'e.g. Apex Hardware Supplies Ltd' : 'e.g. Metro Freight Express'}
            value={formData.businessName}
            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
            error={errors.businessName}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Input
              label="Contact Person Name"
              placeholder="Full Name"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              error={errors.contactName}
            />
            <Input
              label="Phone Number"
              placeholder="+1 (555) 019-2834"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              error={errors.phone}
            />
          </div>

          <Input
            label="Work Email Address"
            type="email"
            placeholder="name@company.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={errors.email}
          />

          <Select
            label={role === 'vendor' ? 'Primary Product Category' : 'Primary Fleet Vehicles'}
            value={formData.industryOrFleet}
            onChange={(e) => setFormData({ ...formData, industryOrFleet: e.target.value })}
            options={
              role === 'vendor'
                ? [
                    { value: 'electronics', label: 'Commercial Electronics & Appliances' },
                    { value: 'retail', label: 'Retail Goods & Apparel' },
                    { value: 'industrial', label: 'Industrial Equipment & Hardware' },
                    { value: 'perishables', label: 'Food & Perishables' },
                    { value: 'other', label: 'General Merchandise' },
                  ]
                : [
                    { value: 'vans', label: 'Cargo Vans & Light Commercial' },
                    { value: 'trucks', label: 'Medium Duty Box Trucks' },
                    { value: 'heavy', label: 'Heavy Duty Freight Trailers' },
                    { value: 'courier', label: 'Motorcycle & Express Couriers' },
                    { value: 'mixed', label: 'Mixed Commercial Fleet' },
                  ]
            }
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight size={16} />}
            >
              {role === 'vendor' ? 'Continue to Vendor Setup' : 'Submit Fleet Profile'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
