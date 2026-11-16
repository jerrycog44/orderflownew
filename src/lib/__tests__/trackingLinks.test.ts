import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildPublicTrackingUrl,
  buildRecipientTrackingUrl,
  clearRecipientTokenForSession,
  extractRecipientTokenFromHash,
  getRecipientTokenForSession,
  isValidRecipientToken,
  saveRecipientTokenForSession,
  scrubUrlHashFragment,
} from '../trackingLinks';
import vercelConfig from '../../../vercel.json';

describe('trackingLinks & Phase 1 HTTP Security Headers', () => {
  const validToken = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('builds clean public tracking URLs with zero query or hash leakage', () => {
    const url = buildPublicTrackingUrl('OF-8492-ABCD', 'https://orderflow.ng/');
    expect(url).toBe('https://orderflow.ng/track/OF-8492-ABCD');
    expect(url).not.toContain('?');
    expect(url).not.toContain('#');
  });

  it('builds recipient capability URLs using #pin_token=<64-hex> URL fragment', () => {
    const url = buildRecipientTrackingUrl(
      'OF-8492-ABCD',
      validToken.toUpperCase(),
      'https://orderflow.ng'
    );
    expect(url).toBe(`https://orderflow.ng/track/OF-8492-ABCD#pin_token=${validToken}`);
  });

  it('throws when building a recipient tracking URL with an invalid or short token', () => {
    expect(() => buildRecipientTrackingUrl('OF-1234', 'short-token')).toThrow(
      /Invalid recipient tracking token/i
    );
    expect(() => buildRecipientTrackingUrl('OF-1234', 'z'.repeat(64))).toThrow(
      /Invalid recipient tracking token/i
    );
  });

  it('extracts and normalizes 64-hex pin_token from URL hash fragments and rejects invalid values', () => {
    expect(extractRecipientTokenFromHash(`#pin_token=${validToken.toUpperCase()}`)).toBe(
      validToken
    );
    expect(extractRecipientTokenFromHash(`pin_token=${validToken}`)).toBe(validToken);
    expect(extractRecipientTokenFromHash('')).toBeNull();
    expect(extractRecipientTokenFromHash('#other=123')).toBeNull();
    expect(extractRecipientTokenFromHash('#pin_token=0000')).toBeNull();
    expect(isValidRecipientToken(validToken)).toBe(true);
    expect(isValidRecipientToken('1234')).toBe(false);
  });

  it('scrubs #pin_token from the browser URL bar immediately via history.replaceState', () => {
    window.history.pushState(null, '', `/track/OF-8492-ABCD?utm=sms#pin_token=${validToken}`);
    const replaceSpy = vi.spyOn(window.history, 'replaceState');

    scrubUrlHashFragment();

    expect(replaceSpy).toHaveBeenCalledWith(null, '', '/track/OF-8492-ABCD?utm=sms');
    expect(window.location.hash).toBe('');
    replaceSpy.mockRestore();
  });

  it('persists and clears validated recipient tokens in tab-scoped sessionStorage', () => {
    saveRecipientTokenForSession('of-8492-abcd', validToken);
    expect(getRecipientTokenForSession('OF-8492-ABCD')).toBe(validToken);

    clearRecipientTokenForSession('OF-8492-ABCD');
    expect(getRecipientTokenForSession('OF-8492-ABCD')).toBeNull();
  });

  it('enforces safe initial HSTS (no includeSubDomains or preload) and strict CSP in vercel.json', () => {
    const globalRule = vercelConfig.headers.find((h) => h.source === '/(.*)');
    expect(globalRule).toBeDefined();

    const headerMap = Object.fromEntries(
      (globalRule?.headers || []).map((h) => [h.key.toLowerCase(), h.value])
    );

    expect(headerMap['strict-transport-security']).toBe('max-age=86400');
    expect(headerMap['strict-transport-security']).not.toMatch(/includeSubDomains/i);
    expect(headerMap['strict-transport-security']).not.toMatch(/preload/i);

    expect(headerMap['permissions-policy']).toContain('camera=(self)');
    expect(headerMap['content-security-policy']).toContain("default-src 'self'");
    expect(headerMap['content-security-policy']).toContain("script-src 'self'");
    expect(headerMap['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headerMap['content-security-policy']).toContain('https://*.supabase.co');
  });
});
