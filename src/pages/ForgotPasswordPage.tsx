import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../auth/AuthContext';

export const ForgotPasswordPage: React.FC = () => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = (): boolean => {
    if (!email.trim()) {
      setEmailError('Email address is required.');
      return false;
    }
    if (!email.includes('@')) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!validate()) return;

    setIsSubmitting(true);
    await forgotPassword({ email });
    setIsSubmitting(false);

    // Always show the confirmation state regardless of whether the email exists.
    // This is intentional — we don't reveal whether an account exists (security).
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <AuthLayout backLink={{ to: '/login', label: 'Back to sign in' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-status-success-bg)',
              border: '1px solid var(--color-status-success-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-5) auto',
            }}
          >
            <CheckCircle2 size={24} color="var(--color-status-success-text)" />
          </div>
          <h1 className="of-auth-heading">Check your inbox</h1>
          <p className="of-auth-subheading">
            If an OrderFlow account exists for <strong>{email}</strong>, a password reset link will be sent shortly. Check your spam folder if it doesn't arrive within a few minutes.
          </p>
          <p
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-muted)',
              marginTop: 'var(--space-4)',
            }}
          >
            ⚠️ Password reset emails are not functional until the backend is connected.
          </p>
          <div style={{ marginTop: 'var(--space-6)' }}>
            <Link to="/login">
              <Button variant="outline" size="md">
                Return to sign in
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout backLink={{ to: '/login', label: 'Back to sign in' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            backgroundColor: 'var(--color-brand-accent-light)',
            border: '1px solid var(--color-brand-accent-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Mail size={20} color="var(--color-brand-accent)" />
        </div>
        <div>
          <h1
            className="of-auth-heading"
            style={{ marginBottom: 0, fontSize: 'var(--font-size-xl)' }}
          >
            Reset your password
          </h1>
        </div>
      </div>

      <p className="of-auth-subheading">
        Enter the email address associated with your OrderFlow account. We'll send a link to reset your password.
      </p>

      <form className="of-auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="Email address"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          autoCapitalize="off"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError('');
          }}
          error={emailError}
          leftIcon={<Mail size={16} />}
        />

        <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
          Send reset link
        </Button>
      </form>

      <p className="of-auth-switch-text">
        Remembered it? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
};
