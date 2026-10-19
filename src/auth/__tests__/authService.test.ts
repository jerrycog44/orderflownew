import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../authService';

describe('AuthService (Local dev & interface contracts)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('validates email format on signup', async () => {
    const result = await authService.signUp({
      fullName: 'Test Vendor',
      email: 'invalid-email',
      phone: '+2348012345678',
      password: 'password123',
    });

    expect(result.session).toBeNull();
    expect(result.error?.code).toBe('invalid_email');
  });

  it('validates password minimum length on signup', async () => {
    const result = await authService.signUp({
      fullName: 'Test Vendor',
      email: 'test@example.com',
      phone: '+2348012345678',
      password: 'short',
    });

    expect(result.session).toBeNull();
    expect(result.error?.code).toBe('weak_password');
  });

  it('signs up and returns valid user session in offline dev mode', async () => {
    const result = await authService.signUp({
      fullName: 'Amaka Logistics',
      email: 'amaka@example.com',
      phone: '08012345678',
      password: 'SecurePassword123!',
    });

    expect(result.error).toBeNull();
    expect(result.session).toBeDefined();
    expect(result.session?.user.email).toBe('amaka@example.com');
    expect(result.session?.user.fullName).toBe('Amaka Logistics');
    expect(result.requiresEmailConfirmation).toBe(false);
  });

  it('prevents duplicate signup with the same email in offline mode', async () => {
    await authService.signUp({
      fullName: 'Vendor One',
      email: 'duplicate@example.com',
      phone: '08012345678',
      password: 'SecurePassword123!',
    });

    const second = await authService.signUp({
      fullName: 'Vendor Two',
      email: 'duplicate@example.com',
      phone: '08099999999',
      password: 'AnotherPassword123!',
    });

    expect(second.session).toBeNull();
    expect(second.error?.code).toBe('email_already_exists');
  });

  it('allows user to sign out and clears active session', async () => {
    await authService.signUp({
      fullName: 'Signout Test',
      email: 'signout@example.com',
      phone: '08011223344',
      password: 'SecurePassword123!',
    });

    expect(authService.getSession()).not.toBeNull();

    await authService.signOut();
    expect(authService.getSession()).toBeNull();
  });
});
