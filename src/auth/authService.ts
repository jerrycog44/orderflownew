/**
 * OrderFlow Auth Service — Supabase & Local Session Fallback Implementation
 *
 * Automatically switches to live Supabase Auth when VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY are present in environment (.env), and gracefully
 * falls back to local session simulation when offline or during initial local dev.
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
import type { User, UserRole, VendorProfile, LogisticsProviderProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Storage Keys
// ---------------------------------------------------------------------------

const SESSION_KEY = 'of_dev_session';
const USERS_KEY = 'of_dev_users';
const VENDOR_PROFILES_KEY = 'of_dev_vendor_profiles';
const PROVIDER_PROFILES_KEY = 'of_dev_provider_profiles';

// Helper for type-safe Supabase table queries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (tableName: string): any => supabase.from(tableName as any);

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
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 1. SUPABASE AUTH SERVICE IMPLEMENTATION (PRODUCTION / LIVE DB)
// ---------------------------------------------------------------------------

class SupabaseAuthService implements IAuthService {
  private currentSession: AuthSession | null = null;

  constructor() {
    this.initSession();
  }

  private async initSession() {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const user = await this.fetchUserProfile(data.session.user.id, data.session.user.email || '');
        if (user) {
          this.currentSession = {
            user,
            accessToken: data.session.access_token,
            expiresAt: new Date((data.session.expires_at || 0) * 1000).toISOString(),
          };
          saveSession(this.currentSession);
        }
      }
    } catch (e) {
      console.warn('Failed to restore Supabase session', e);
    }
  }

  private async fetchUserProfile(userId: string, fallbackEmail: string): Promise<User | null> {
    try {
      const { data: profile, error } = await fromTable('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !profile) return null;

      return {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email || fallbackEmail,
        phone: profile.phone,
        role: profile.role as UserRole | null,
        onboardingCompleted: profile.onboarding_completed,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      };
    } catch {
      return null;
    }
  }

  getSession(): AuthSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const session: AuthSession = JSON.parse(raw);
        if (new Date(session.expiresAt) > new Date()) {
          return session;
        }
      }
    } catch {
      // ignore
    }
    return this.currentSession;
  }

  async signUp(input: SignUpInput): Promise<{ session: AuthSession | null; error: AuthError | null }> {
    if (!input.email || !input.email.includes('@')) {
      return { session: null, error: { code: 'invalid_email', message: 'Please enter a valid email address.' } };
    }
    if (!input.password || input.password.length < 8) {
      return { session: null, error: { code: 'weak_password', message: 'Password must be at least 8 characters long.' } };
    }

    let formattedPhone = input.phone.trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+${formattedPhone.replace(/^0+/, '')}`;
      if (!formattedPhone.startsWith('+234') && formattedPhone.length <= 11) {
        formattedPhone = `+234${input.phone.trim().replace(/^0+/, '')}`;
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          full_name: input.fullName.trim(),
          phone: formattedPhone,
        },
      },
    });

    if (error) {
      return {
        session: null,
        error: {
          code: error.message.includes('already registered') ? 'email_already_exists' : 'unknown',
          message: error.message,
        },
      };
    }

    if (!data.user) {
      return { session: null, error: { code: 'unknown', message: 'Signup failed. Please try again.' } };
    }

    // Profile row is auto-created by the handle_new_user() database trigger.
    // We update phone here in case the trigger stored a partial value from metadata.
    await fromTable('profiles')
      .update({ phone: formattedPhone, full_name: input.fullName.trim() })
      .eq('id', data.user.id);

    const user: User = {
      id: data.user.id,
      fullName: input.fullName.trim(),
      email: input.email.toLowerCase().trim(),
      phone: formattedPhone,
      role: null,
      onboardingCompleted: false,
      createdAt: now(),
      updatedAt: now(),
    };

    const session: AuthSession = {
      user,
      accessToken: data.session?.access_token || `sb_token_${data.user.id}`,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    };

    this.currentSession = session;
    saveSession(session);

    return { session, error: null };
  }

  async login(input: LoginInput): Promise<{ session: AuthSession | null; error: AuthError | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });

    if (error) {
      return {
        session: null,
        error: {
          code: error.message.includes('Invalid login credentials') ? 'invalid_credentials' : 'unknown',
          message: error.message,
        },
      };
    }

    if (!data.user) {
      return { session: null, error: { code: 'user_not_found', message: 'Account not found.' } };
    }

    let user = await this.fetchUserProfile(data.user.id, data.user.email || input.email);
    if (!user) {
      user = {
        id: data.user.id,
        fullName: data.user.user_metadata?.full_name || 'User',
        email: data.user.email || input.email,
        phone: data.user.user_metadata?.phone || '+2340000000000',
        role: null,
        onboardingCompleted: false,
        createdAt: now(),
        updatedAt: now(),
      };
      await fromTable('profiles').upsert({
        id: user.id,
        full_name: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        onboarding_completed: false,
      });
    }

    const session: AuthSession = {
      user,
      accessToken: data.session.access_token,
      expiresAt: new Date((data.session.expires_at || 0) * 1000).toISOString(),
    };

    this.currentSession = session;
    saveSession(session);

    return { session, error: null };
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(input.email);
    if (error) {
      return { error: { code: 'unknown', message: error.message } };
    }
    return { error: null };
  }

  async setRole(input: UpdateRoleInput): Promise<{ user: User | null; error: AuthError | null }> {
    // Use upsert as safety net: if trigger somehow missed creating the profile row,
    // this ensures it exists before vendor/provider tables FK-reference it.
    const session = this.getSession();
    const { error } = await fromTable('profiles').upsert({
      id: input.userId,
      role: input.role,
      full_name: session?.user.fullName || 'User',
      email: session?.user.email || '',
      phone: session?.user.phone || null,
      onboarding_completed: false,
    });

    if (error) {
      return { user: null, error: { code: 'unknown', message: error.message } };
    }

    if (session && session.user.id === input.userId) {
      const updatedUser: User = { ...session.user, role: input.role, updatedAt: now() };
      const updatedSession: AuthSession = { ...session, user: updatedUser };
      this.currentSession = updatedSession;
      saveSession(updatedSession);
      return { user: updatedUser, error: null };
    }

    const updatedUser = await this.fetchUserProfile(input.userId, '');
    return { user: updatedUser, error: null };
  }

  async completeVendorOnboarding(input: CompleteVendorOnboardingInput): Promise<{ user: User | null; error: AuthError | null }> {
    const { error: vendorErr } = await fromTable('vendors').upsert({
      id: input.userId,
      business_name: input.profile.businessName,
      business_category: input.profile.businessCategory,
      operating_city: input.profile.operatingCity,
    });

    if (vendorErr) {
      return { user: null, error: { code: 'unknown', message: vendorErr.message } };
    }

    const { error: profileErr } = await fromTable('profiles')
      .update({ onboarding_completed: true })
      .eq('id', input.userId);

    if (profileErr) {
      return { user: null, error: { code: 'unknown', message: profileErr.message } };
    }

    const session = this.getSession();
    if (session && session.user.id === input.userId) {
      const updatedUser: User = { ...session.user, onboardingCompleted: true, updatedAt: now() };
      const updatedSession: AuthSession = { ...session, user: updatedUser };
      this.currentSession = updatedSession;
      saveSession(updatedSession);
      return { user: updatedUser, error: null };
    }

    const updatedUser = await this.fetchUserProfile(input.userId, '');
    return { user: updatedUser, error: null };
  }

  async completeProviderOnboarding(input: CompleteProviderOnboardingInput): Promise<{ user: User | null; error: AuthError | null }> {
    const { error: providerErr } = await fromTable('logistics_providers').upsert({
      id: input.userId,
      provider_name: input.profile.providerName,
      provider_type: input.profile.providerType,
      coverage_area: input.profile.coverageArea,
      vehicle_types: input.profile.vehicleTypes,
      package_categories: input.profile.packageCategories,
    });

    if (providerErr) {
      return { user: null, error: { code: 'unknown', message: providerErr.message } };
    }

    await fromTable('provider_availability').upsert({
      provider_id: input.userId,
      status: input.profile.availability || 'available',
    });

    const { error: profileErr } = await fromTable('profiles')
      .update({ onboarding_completed: true })
      .eq('id', input.userId);

    if (profileErr) {
      return { user: null, error: { code: 'unknown', message: profileErr.message } };
    }

    const session = this.getSession();
    if (session && session.user.id === input.userId) {
      const updatedUser: User = { ...session.user, onboardingCompleted: true, updatedAt: now() };
      const updatedSession: AuthSession = { ...session, user: updatedUser };
      this.currentSession = updatedSession;
      saveSession(updatedSession);
      return { user: updatedUser, error: null };
    }

    const updatedUser = await this.fetchUserProfile(input.userId, '');
    return { user: updatedUser, error: null };
  }

  signOut(): void {
    supabase.auth.signOut();
    this.currentSession = null;
    clearSession();
  }
}

// ---------------------------------------------------------------------------
// 2. LOCAL DEV MOCK AUTH SERVICE IMPLEMENTATION
// ---------------------------------------------------------------------------

class LocalAuthService implements IAuthService {
  getSession(): AuthSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session: AuthSession = JSON.parse(raw);
      if (new Date(session.expiresAt) < new Date()) {
        clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  async signUp(input: SignUpInput): Promise<{ session: AuthSession | null; error: AuthError | null }> {
    await delay(600);

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

  async login(input: LoginInput): Promise<{ session: AuthSession | null; error: AuthError | null }> {
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

  async forgotPassword(_input: ForgotPasswordInput): Promise<{ error: AuthError | null }> {
    await delay(800);
    return { error: null };
  }

  async setRole(input: UpdateRoleInput): Promise<{ user: User | null; error: AuthError | null }> {
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

  async completeVendorOnboarding(input: CompleteVendorOnboardingInput): Promise<{ user: User | null; error: AuthError | null }> {
    await delay(700);

    const session = this.getSession();
    if (!session) {
      return { user: null, error: { code: 'unknown', message: 'Session not found. Please sign in again.' } };
    }

    const profiles: Record<string, VendorProfile> = JSON.parse(localStorage.getItem(VENDOR_PROFILES_KEY) || '{}');
    const profile: VendorProfile = {
      userId: input.userId,
      ...input.profile,
      createdAt: now(),
    };
    profiles[input.userId] = profile;
    localStorage.setItem(VENDOR_PROFILES_KEY, JSON.stringify(profiles));

    const updatedUser: User = { ...session.user, onboardingCompleted: true, updatedAt: now() };
    const updatedSession = makeSession(updatedUser);
    saveSession(updatedSession);
    updateUserInStorage(updatedUser);

    return { user: updatedUser, error: null };
  }

  async completeProviderOnboarding(input: CompleteProviderOnboardingInput): Promise<{ user: User | null; error: AuthError | null }> {
    await delay(700);

    const session = this.getSession();
    if (!session) {
      return { user: null, error: { code: 'unknown', message: 'Session not found. Please sign in again.' } };
    }

    const profiles: Record<string, LogisticsProviderProfile> = JSON.parse(localStorage.getItem(PROVIDER_PROFILES_KEY) || '{}');
    const profile: LogisticsProviderProfile = {
      userId: input.userId,
      ...input.profile,
      createdAt: now(),
    };
    profiles[input.userId] = profile;
    localStorage.setItem(PROVIDER_PROFILES_KEY, JSON.stringify(profiles));

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

// ---------------------------------------------------------------------------
// Export Auth Singleton (Auto-detects live Supabase environment)
// ---------------------------------------------------------------------------

export const authService: IAuthService = isSupabaseConfigured
  ? new SupabaseAuthService()
  : new LocalAuthService();
