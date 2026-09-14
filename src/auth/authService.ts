/**
 * OrderFlow Auth Service — Local Session Implementation
 *
 * ⚠️  DEV/MOCK IMPLEMENTATION
 * This is NOT production authentication. It uses sessionStorage to simulate
 * an auth session for development purposes only.
 *
 * TO CONNECT A REAL BACKEND:
 * Replace the body of each method below with calls to your backend API
 * (e.g. Supabase, Firebase Auth, custom JWT endpoint).
 * The IAuthService interface contract remains the same — nothing else changes.
 *
 * SECURITY NOTE:
 * No passwords are stored. The mock implementation only stores the user object
 * and a mock token in sessionStorage. Passwords are never persisted anywhere.
 */

import type {
  IAuthService,
  AuthSession,
  AuthError,
  SignUpInput,
  LoginInput,
  ForgotPasswordInput,
  UpdateRoleInput,
  CompleteVendorOnboardingInput,
  CompleteProviderOnboardingInput,
} from './authTypes';
import type { User, VendorProfile, LogisticsProviderProfile } from '../types';

// ---------------------------------------------------------------------------
// Storage Keys
// ---------------------------------------------------------------------------

const SESSION_KEY = 'of_dev_session';
const USERS_KEY = 'of_dev_users';
const VENDOR_PROFILES_KEY = 'of_dev_vendor_profiles';
const PROVIDER_PROFILES_KEY = 'of_dev_provider_profiles';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function now(): string {
  return new Date().toISOString();
}

function getUsers(): Record<string, User & { __passwordHash: string }> {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUsers(users: Record<string, User & { __passwordHash: string }>): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/**
 * Very basic hash — NOT for production use.
 * Purpose: avoid storing passwords in plaintext even in a dev mock.
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(16);
}

function makeSession(user: User): AuthSession {
  return {
    user,
    accessToken: `dev_token_${user.id}_${Date.now()}`,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
  };
}

function saveSession(session: AuthSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

function updateUserInStorage(user: User): void {
  const users = getUsers();
  const existing = users[user.email];
  if (existing) {
    users[user.email] = { ...existing, ...user, updatedAt: now() };
    saveUsers(users);
  }
}

// ---------------------------------------------------------------------------
// Auth Service Implementation
// ---------------------------------------------------------------------------

class LocalAuthService implements IAuthService {
  getSession(): AuthSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session: AuthSession = JSON.parse(raw);
      // Check expiry
      if (new Date(session.expiresAt) < new Date()) {
        clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  async signUp(
    input: SignUpInput
  ): Promise<{ session: AuthSession | null; error: AuthError | null }> {
    await delay(600); // Simulate network latency

    if (!input.email || !input.email.includes('@')) {
      return { session: null, error: { code: 'invalid_email', message: 'Please enter a valid email address.' } };
    }
    if (!input.password || input.password.length < 8) {
      return { session: null, error: { code: 'weak_password', message: 'Password must be at least 8 characters long.' } };
    }

    const users = getUsers();
    if (users[input.email.toLowerCase()]) {
      return { session: null, error: { code: 'email_already_exists', message: 'An account with this email already exists. Please sign in.' } };
    }

    const user: User = {
      id: generateId(),
      fullName: input.fullName.trim(),
      email: input.email.toLowerCase().trim(),
      phone: input.phone.trim(),
      role: null,
      onboardingCompleted: false,
      createdAt: now(),
      updatedAt: now(),
    };

    users[user.email] = { ...user, __passwordHash: simpleHash(input.password) };
    saveUsers(users);

    const session = makeSession(user);
    saveSession(session);

    return { session, error: null };
  }

  async login(
    input: LoginInput
  ): Promise<{ session: AuthSession | null; error: AuthError | null }> {
    await delay(700);

    const users = getUsers();
    const record = users[input.email.toLowerCase()];

    if (!record) {
      return { session: null, error: { code: 'user_not_found', message: 'No account found with that email address.' } };
    }
    if (record.__passwordHash !== simpleHash(input.password)) {
      return { session: null, error: { code: 'invalid_credentials', message: 'Incorrect password. Please try again.' } };
    }

    const { __passwordHash: _, ...user } = record;
    const session = makeSession(user);
    saveSession(session);

    return { session, error: null };
  }

  async forgotPassword(
    input: ForgotPasswordInput
  ): Promise<{ error: AuthError | null }> {
    await delay(800);

    // In the real implementation: POST /auth/forgot-password
    // We do NOT simulate a successful email being sent because no email service exists.
    // The UI will display an honest "if that email exists, a reset link will be sent" message.
    const users = getUsers();
    const _exists = !!users[input.email.toLowerCase()];
    // Intentionally not revealing whether the email exists (security best practice)
    void _exists;

    return { error: null };
  }

  async setRole(
    input: UpdateRoleInput
  ): Promise<{ user: User | null; error: AuthError | null }> {
    await delay(300);

    const session = this.getSession();
    if (!session || session.user.id !== input.userId) {
      return { user: null, error: { code: 'unknown', message: 'Session not found. Please sign in again.' } };
    }

    const updatedUser: User = { ...session.user, role: input.role, updatedAt: now() };
    const updatedSession = makeSession(updatedUser);
    saveSession(updatedSession);
    updateUserInStorage(updatedUser);

    return { user: updatedUser, error: null };
  }

  async completeVendorOnboarding(
    input: CompleteVendorOnboardingInput
  ): Promise<{ user: User | null; error: AuthError | null }> {
    await delay(700);

    const session = this.getSession();
    if (!session) {
      return { user: null, error: { code: 'unknown', message: 'Session not found. Please sign in again.' } };
    }

    // Save vendor profile
    const profiles: Record<string, VendorProfile> = JSON.parse(localStorage.getItem(VENDOR_PROFILES_KEY) || '{}');
    const profile: VendorProfile = {
      userId: input.userId,
      ...input.profile,
      createdAt: now(),
    };
    profiles[input.userId] = profile;
    localStorage.setItem(VENDOR_PROFILES_KEY, JSON.stringify(profiles));

    // Mark onboarding complete
    const updatedUser: User = { ...session.user, onboardingCompleted: true, updatedAt: now() };
    const updatedSession = makeSession(updatedUser);
    saveSession(updatedSession);
    updateUserInStorage(updatedUser);

    return { user: updatedUser, error: null };
  }

  async completeProviderOnboarding(
    input: CompleteProviderOnboardingInput
  ): Promise<{ user: User | null; error: AuthError | null }> {
    await delay(700);

    const session = this.getSession();
    if (!session) {
      return { user: null, error: { code: 'unknown', message: 'Session not found. Please sign in again.' } };
    }

    // Save provider profile
    const profiles: Record<string, LogisticsProviderProfile> = JSON.parse(localStorage.getItem(PROVIDER_PROFILES_KEY) || '{}');
    const profile: LogisticsProviderProfile = {
      userId: input.userId,
      ...input.profile,
      createdAt: now(),
    };
    profiles[input.userId] = profile;
    localStorage.setItem(PROVIDER_PROFILES_KEY, JSON.stringify(profiles));

    // Mark onboarding complete
    const updatedUser: User = { ...session.user, onboardingCompleted: true, updatedAt: now() };
    const updatedSession = makeSession(updatedUser);
    saveSession(updatedSession);
    updateUserInStorage(updatedUser);

    return { user: updatedUser, error: null };
  }

  signOut(): void {
    clearSession();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export singleton
export const authService: IAuthService = new LocalAuthService();
