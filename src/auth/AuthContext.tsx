/**
 * OrderFlow AuthContext
 *
 * Provides application-wide authentication state and actions.
 * All components should consume auth state through useAuth() — never
 * directly from authService.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from './authService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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
  signUp: (input: SignUpInput) => Promise<{ error: AuthError | null; requiresEmailConfirmation?: boolean }>;
  login: (input: LoginInput) => Promise<{ user: User | null; error: AuthError | null }>;
  forgotPassword: (input: ForgotPasswordInput) => Promise<{ error: AuthError | null }>;
  setRole: (role: UserRole) => Promise<{ error: AuthError | null }>;
  completeVendorOnboarding: (
    input: Omit<CompleteVendorOnboardingInput, 'userId'>
  ) => Promise<{ error: AuthError | null }>;
  completeProviderOnboarding: (
    input: Omit<CompleteProviderOnboardingInput, 'userId'>
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context & Provider
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to Supabase auth events and restore user profile reactively
  useEffect(() => {
    let isMounted = true;

    if (isSupabaseConfigured) {
      // 1. Initial session load
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.user) {
          const profile = await authService.fetchUserProfile?.(
            session.user.id,
            session.user.email || ''
          );
          if (isMounted) setUser(profile ?? null);
        } else {
          if (isMounted) setUser(null);
        }
        if (isMounted) setIsLoading(false);
      });

      // 2. Auth state subscription (token refresh, sign-in, sign-out in another tab)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          if (!isMounted) return;
          if (session?.user) {
            const profile = await authService.fetchUserProfile?.(
              session.user.id,
              session.user.email || ''
            );
            if (isMounted) setUser(profile ?? null);
          } else {
            if (isMounted) setUser(null);
          }
          if (isMounted) setIsLoading(false);
        }
      );

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } else {
      // Local dev simulation mode — schedule microtask to avoid synchronous render-phase update
      queueMicrotask(() => {
        if (!isMounted) return;
        const session = authService.getSession();
        setUser(session?.user ?? null);
        setIsLoading(false);
      });
    }
  }, []);

  const signUp = useCallback(async (input: SignUpInput): Promise<{ error: AuthError | null; requiresEmailConfirmation?: boolean }> => {
    const { session, error, requiresEmailConfirmation } = await authService.signUp(input);
    if (session) {
      setUser(session.user);
    }
    return { error, requiresEmailConfirmation };
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

  const signOut = useCallback(async () => {
    await authService.signOut();
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
