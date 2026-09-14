import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, User, Mail, Phone, Lock, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../auth/AuthContext';

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp } = useAuth();

  // Pre-fill role hint from landing page CTAs (e.g. /signup?role=logistics_provider)
  const roleHint = searchParams.get('role');

  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!formData.email.trim()) errs.email = 'Email address is required.';
    else if (!formData.email.includes('@')) errs.email = 'Please enter a valid email address.';
    if (!formData.phone.trim()) errs.phone = 'Phone number is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.password) errs.password = 'Password is required.';
    else if (formData.password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (!formData.confirmPassword) errs.confirmPassword = 'Please confirm your password.';
    else if (formData.password !== formData.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!validateStep2()) return;

    setIsSubmitting(true);
    const { error } = await signUp({
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
    });
    setIsSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    // Redirect directly to role selection (scroll reset handles clean top positioning)
    navigate('/role-selection' + (roleHint ? `?role=${roleHint}` : ''), { replace: true });
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (authError) setAuthError(null);
  };

  const getPasswordStrength = (): { label: string; color: string; width: string } | null => {
    const p = formData.password;
    if (!p) return null;
    if (p.length < 8) return { label: 'Too short', color: 'var(--color-status-error-text)', width: '20%' };
    const hasUpper = /[A-Z]/.test(p);
    const hasNum = /[0-9]/.test(p);
    const hasSpec = /[^A-Za-z0-9]/.test(p);
    const score = [hasUpper, hasNum, hasSpec].filter(Boolean).length;
    if (score === 0) return { label: 'Weak', color: 'var(--color-status-warning-text)', width: '40%' };
    if (score === 1) return { label: 'Fair', color: '#B45309', width: '60%' };
    if (score === 2) return { label: 'Good', color: '#166534', width: '80%' };
    return { label: 'Strong', color: 'var(--color-status-success-text)', width: '100%' };
  };

  const strength = getPasswordStrength();

  return (
    <AuthLayout backLink={{ to: '/', label: 'Back to OrderFlow' }}>
      {/* Subtle Step Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Step {step} of 2
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ width: '24px', height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-brand)' }} />
          <div style={{ width: '24px', height: '4px', borderRadius: '2px', backgroundColor: step === 2 ? 'var(--color-brand)' : 'var(--color-border)' }} />
        </div>
      </div>

      {step === 1 ? (
        <>
          <h1 className="of-auth-heading">Create your account</h1>
          <p className="of-auth-subheading">
            Enter your details to get started with OrderFlow.
          </p>

          {authError && (
            <div className="of-auth-error-banner" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{authError}</span>
            </div>
          )}

          <form className="of-auth-form" onSubmit={handleStep1Submit} noValidate>
            <Input
              label="Full name"
              type="text"
              placeholder="Your full name"
              autoComplete="name"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              error={errors.fullName}
              leftIcon={<User size={16} />}
            />

            <Input
              label="Work email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              autoCapitalize="off"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={errors.email}
              leftIcon={<Mail size={16} />}
            />

            <Input
              label="Phone number"
              type="tel"
              placeholder="+1 555 000 1234"
              autoComplete="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              error={errors.phone}
              helperText="Used for delivery notifications and account verification."
              leftIcon={<Phone size={16} />}
            />

            <Button type="submit" variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>
              Continue
            </Button>
          </form>
        </>
      ) : (
        <>
          <h1 className="of-auth-heading">Create a password</h1>
          <p className="of-auth-subheading">
            Choose a password to secure your OrderFlow account.
          </p>

          {authError && (
            <div className="of-auth-error-banner" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{authError}</span>
            </div>
          )}

          <form className="of-auth-form" onSubmit={handleStep2Submit} noValidate>
            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                error={errors.password}
                leftIcon={<Lock size={16} />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
              {strength && !errors.password && (
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <div style={{ height: '3px', backgroundColor: 'var(--color-bg-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: strength.width, backgroundColor: strength.color, transition: 'width 0.3s ease' }} />
                  </div>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: strength.color, marginTop: '4px', fontWeight: 500 }}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            <Input
              label="Confirm password"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Repeat your password"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              error={errors.confirmPassword}
              leftIcon={
                formData.confirmPassword && formData.confirmPassword === formData.password
                  ? <CheckCircle2 size={16} color="var(--color-status-success-text)" />
                  : <Lock size={16} />
              }
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setStep(1)}
                leftIcon={<ArrowLeft size={18} />}
                style={{ flex: 1 }}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                style={{ flex: 2 }}
              >
                Create account
              </Button>
            </div>

            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.5, marginTop: 'var(--space-3)' }}>
              By creating an account you agree to our{' '}
              <Link to="/terms" style={{ color: 'var(--color-text-secondary)' }}>Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" style={{ color: 'var(--color-text-secondary)' }}>Privacy Policy</Link>.
            </p>
          </form>
        </>
      )}

      <p className="of-auth-switch-text" style={{ marginTop: 'var(--space-6)' }}>
        Already have an account?{' '}
        <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
};
