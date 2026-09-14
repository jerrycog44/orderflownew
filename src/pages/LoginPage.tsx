import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Mail, Lock } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../auth/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || null;

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.email.trim()) errs.email = 'Email address is required.';
    else if (!formData.email.includes('@')) errs.email = 'Please enter a valid email address.';
    if (!formData.password) errs.password = 'Password is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    const { user: loggedInUser, error } = await login({ email: formData.email, password: formData.password });
    setIsSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    if (loggedInUser) {
      let dest = from;
      if (!dest) {
        if (!loggedInUser.role) {
          dest = '/role-selection';
        } else if (!loggedInUser.onboardingCompleted) {
          dest = loggedInUser.role === 'vendor' ? '/onboarding/vendor' : '/onboarding/provider';
        } else {
          dest = loggedInUser.role === 'vendor' ? '/vendor/dashboard' : '/logistics/dashboard';
        }
      }
      navigate(dest, { replace: true });
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (authError) setAuthError(null);
  };

  return (
    <AuthLayout>
      <h1 className="of-auth-heading">Sign in to OrderFlow</h1>
      <p className="of-auth-subheading">
        Welcome back. Enter your credentials to access your account.
      </p>

      {authError && (
        <div className="of-auth-error-banner" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{authError}</span>
        </div>
      )}

      <form className="of-auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="Email address"
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
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Your password"
          autoComplete="current-password"
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-var(--space-2)' }}>
          <Link
            to="/forgot-password"
            style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-brand-accent)', fontWeight: 500 }}
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          className="of-auth-submit-btn"
        >
          Sign in
        </Button>
      </form>

      <p className="of-auth-switch-text">
        Don't have an account?{' '}
        <Link to="/signup">Create account</Link>
      </p>
    </AuthLayout>
  );
};
