/**
 * OrderFlow AuthContext
 *
 * Provides application-wide authentication state and actions.
 * All components should consume auth state through useAuth() — never
 * directly from authService.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from './authService';
import type {
  AuthError,
  SignUpInput,
  LoginInput,
  ForgotPasswordInput,
  CompleteVendorOnboardingInput,
  CompleteProviderOnboardingInput,
} from './authTypes';
import type { User, UserRole } from '../types';

// ---------------------------------------------------------------------------
// Context Type
// ---------------------------------------------------------------------------

interface AuthContextValue {
  /** The currently authenticated user, or null if unauthenticated */
  user: User | null;
  /** True while the initial session check is in progress */
  isLoading: boolean;
  /** Convenience derived state */
  isAuthenticated: boolean;
  role: UserRole | null;
  hasCompletedOnboarding: boolean;

  // Actions
  signUp: (input: SignUpInput) => Promise<{ error: AuthError | null }>;
  login: (input: LoginInput) => Promise<{ user: User | null; error: AuthError | null }>;
  forgotPassword: (input: ForgotPasswordInput) => Promise<{ error: AuthError | null }>;
  setRole: (role: UserRole) => Promise<{ error: AuthError | null }>;
  completeVendorOnboarding: (
    input: Omit<CompleteVendorOnboardingInput, 'userId'>
  ) => Promise<{ error: AuthError | null }>;
  completeProviderOnboarding: (
    input: Omit<CompleteProviderOnboardingInput, 'userId'>
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => void;
}

// ---------------------------------------------------------------------------
// Context & Provider
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore session from storage
  useEffect(() => {
    const session = authService.getSession();
    setUser(session?.user ?? null);
    setIsLoading(false);
  }, []);

  const signUp = useCallback(async (input: SignUpInput): Promise<{ error: AuthError | null }> => {
    const { session, error } = await authService.signUp(input);
    if (session) {
      setUser(session.user);
    }
    return { error };
  }, []);

  const login = useCallback(async (input: LoginInput): Promise<{ user: User | null; error: AuthError | null }> => {
    const { session, error } = await authService.login(input);
    if (session) {
      setUser(session.user);
    }
    return { user: session?.user ?? null, error };
  }, []);

  const forgotPassword = useCallback(
    async (input: ForgotPasswordInput): Promise<{ error: AuthError | null }> => {
      return authService.forgotPassword(input);
    },
    []
  );

  const setRole = useCallback(
    async (role: UserRole): Promise<{ error: AuthError | null }> => {
      if (!user) return { error: { code: 'unknown', message: 'Not authenticated.' } };
      const { user: updated, error } = await authService.setRole({ userId: user.id, role });
      if (updated) setUser(updated);
      return { error };
    },
    [user]
  );

  const completeVendorOnboarding = useCallback(
    async (
      input: Omit<CompleteVendorOnboardingInput, 'userId'>
    ): Promise<{ error: AuthError | null }> => {
      if (!user) return { error: { code: 'unknown', message: 'Not authenticated.' } };
      const { user: updated, error } = await authService.completeVendorOnboarding({
        userId: user.id,
        ...input,
      });
      if (updated) setUser(updated);
      return { error };
    },
    [user]
  );

  const completeProviderOnboarding = useCallback(
    async (
      input: Omit<CompleteProviderOnboardingInput, 'userId'>
    ): Promise<{ error: AuthError | null }> => {
      if (!user) return { error: { code: 'unknown', message: 'Not authenticated.' } };
      const { user: updated, error } = await authService.completeProviderOnboarding({
        userId: user.id,
        ...input,
      });
      if (updated) setUser(updated);
      return { error };
    },
    [user]
  );

  const signOut = useCallback(() => {
    authService.signOut();
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    role: user?.role ?? null,
    hasCompletedOnboarding: user?.onboardingCompleted ?? false,
    signUp,
    login,
    forgotPassword,
    setRole,
    completeVendorOnboarding,
    completeProviderOnboarding,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
