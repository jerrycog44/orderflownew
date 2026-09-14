/**
 * OrderFlow Auth Types
 *
 * These types define the authentication contract between the UI and the
 * auth service. They are intentionally separated from the domain User type
 * so that the auth layer can be swapped (e.g. Supabase, Firebase, custom JWT)
 * without touching domain models.
 */

import type { User, UserRole, VendorProfile, LogisticsProviderProfile } from '../types';

// ---------------------------------------------------------------------------
// Auth Session
// ---------------------------------------------------------------------------

export interface AuthSession {
  user: User;
  /** Access token — will be a real JWT once backend is connected */
  accessToken: string;
  expiresAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Auth Error
// ---------------------------------------------------------------------------

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_already_exists'
  | 'user_not_found'
  | 'weak_password'
  | 'invalid_email'
  | 'network_error'
  | 'unknown';

export interface AuthError {
  code: AuthErrorCode;
  message: string; // Human-readable message for display
}

// ---------------------------------------------------------------------------
// Auth Service Input Types
// ---------------------------------------------------------------------------

export interface SignUpInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface UpdateRoleInput {
  userId: string;
  role: UserRole;
}

export interface CompleteVendorOnboardingInput {
  userId: string;
  profile: Omit<VendorProfile, 'userId' | 'createdAt'>;
}

export interface CompleteProviderOnboardingInput {
  userId: string;
  profile: Omit<LogisticsProviderProfile, 'userId' | 'createdAt'>;
}

// ---------------------------------------------------------------------------
// Auth Service Interface
//
// This interface defines the contract that the real backend implementation
// must satisfy. The current implementation (authService.ts) is a local-session
// dev implementation. Replacing it with a real backend only requires
// implementing this interface.
// ---------------------------------------------------------------------------

export interface IAuthService {
  /** Returns the current session if one exists */
  getSession(): AuthSession | null;

  /** Sign up a new user */
  signUp(input: SignUpInput): Promise<{ session: AuthSession | null; error: AuthError | null }>;

  /** Sign in an existing user */
  login(input: LoginInput): Promise<{ session: AuthSession | null; error: AuthError | null }>;

  /** Send a password reset request */
  forgotPassword(input: ForgotPasswordInput): Promise<{ error: AuthError | null }>;

  /** Update the user's role (called once after signup) */
  setRole(input: UpdateRoleInput): Promise<{ user: User | null; error: AuthError | null }>;

  /** Complete vendor onboarding and mark onboarding as done */
  completeVendorOnboarding(
    input: CompleteVendorOnboardingInput
  ): Promise<{ user: User | null; error: AuthError | null }>;

  /** Complete logistics provider onboarding and mark onboarding as done */
  completeProviderOnboarding(
    input: CompleteProviderOnboardingInput
  ): Promise<{ user: User | null; error: AuthError | null }>;

  /** Sign out the current user */
  signOut(): void;
}
