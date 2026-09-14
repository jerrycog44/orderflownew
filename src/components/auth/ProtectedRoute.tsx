import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { UserRole } from '../../types';
import { Spinner } from '../ui/Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If set, user must have this role to access the route */
  requiredRole?: UserRole;
  /** If true, route is only for users who have NOT completed onboarding */
  onboardingOnly?: boolean;
}

/**
 * Role-aware route guard.
 *
 * Redirect logic:
 *  - Loading → show spinner (prevents flash)
 *  - Not authenticated → /login
 *  - Authenticated, no role → /role-selection
 *  - Authenticated, role set, not onboarded → /onboarding/:role
 *  - Authenticated, wrong role → redirect to own dashboard
 *  - All checks pass → render children
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  onboardingOnly = false,
}) => {
  const { isLoading, isAuthenticated, role, hasCompletedOnboarding } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--color-bg-app)',
        }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  // Not authenticated → go to login, preserve intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but no role yet → must choose role
  if (!role && !onboardingOnly) {
    return <Navigate to="/role-selection" replace />;
  }

  // Role set but onboarding not complete → send to their onboarding flow
  if (role && !hasCompletedOnboarding && !onboardingOnly) {
    const dest = role === 'vendor' ? '/onboarding/vendor' : '/onboarding/provider';
    return <Navigate to={dest} replace />;
  }

  // Wrong role access → redirect to their own dashboard
  if (requiredRole && role !== requiredRole) {
    const ownDashboard = role === 'vendor' ? '/vendor/dashboard' : '/logistics/dashboard';
    return <Navigate to={ownDashboard} replace />;
  }

  return <>{children}</>;
};

/**
 * Redirect authenticated users away from auth pages (login, signup).
 * If the user is fully set up, send them to their dashboard.
 */
export const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, role, hasCompletedOnboarding } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--color-bg-app)',
        }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    if (!role) return <Navigate to="/role-selection" replace />;
    if (!hasCompletedOnboarding) {
      return (
        <Navigate
          to={role === 'vendor' ? '/onboarding/vendor' : '/onboarding/provider'}
          replace
        />
      );
    }
    return (
      <Navigate
        to={role === 'vendor' ? '/vendor/dashboard' : '/logistics/dashboard'}
        replace
      />
    );
  }

  return <>{children}</>;
};
