/**
 * OrderFlow — Channel-Agnostic Tracking Link & Recipient Token Utilities
 *
 * Security Invariants:
 * 1. Public tracking links contain ONLY `/track/<trackingCode>` — never any
 *    query parameters or URL fragments.
 * 2. Recipient tracking links place the 256-bit (64-hex) capability token
 *    exclusively in the URL hash fragment (`#pin_token=<64-hex>`), which RFC
 *    3986 / Fetch guarantee is never sent in HTTP request paths or `Referer`
 *    headers.
 * 3. `scrubUrlHashFragment()` removes `#pin_token=...` from the browser address
 *    bar immediately via `window.history.replaceState` before external assets
 *    or user screen-shares can observe it.
 */

export const RECIPIENT_TOKEN_REGEX = /^[0-9a-f]{64}$/;

const SESSION_STORAGE_PREFIX = 'of_pin_tok:';

function resolveOrigin(explicitOrigin?: string): string {
  if (explicitOrigin && explicitOrigin.trim()) {
    return explicitOrigin.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'https://orderflow.ng';
}

function normalizeSessionKey(trackingCode: string): string {
  return `${SESSION_STORAGE_PREFIX}${trackingCode.trim().toUpperCase()}`;
}

export function isValidRecipientToken(token: string | null | undefined): token is string {
  if (!token) return false;
  return RECIPIENT_TOKEN_REGEX.test(token.trim().toLowerCase());
}

/**
 * Builds a clean, public milestone-only tracking URL (`/track/<trackingCode>`).
 * Explicitly ignores `window.location.href` and any current URL hash/search.
 */
export function buildPublicTrackingUrl(trackingCode: string, origin?: string): string {
  const cleanCode = trackingCode.trim();
  return `${resolveOrigin(origin)}/track/${encodeURIComponent(cleanCode)}`;
}

/**
 * Builds a recipient capability tracking URL containing `#pin_token=<64-hex>`.
 * Throws if `recipientToken` is missing or malformed so callers never silently
 * share a broken capability link as a recipient link.
 */
export function buildRecipientTrackingUrl(
  trackingCode: string,
  recipientToken: string,
  origin?: string
): string {
  const normalizedToken = recipientToken.trim().toLowerCase();
  if (!RECIPIENT_TOKEN_REGEX.test(normalizedToken)) {
    throw new Error('Invalid recipient tracking token format');
  }
  return `${buildPublicTrackingUrl(trackingCode, origin)}#pin_token=${normalizedToken}`;
}

/**
 * Extracts and validates `pin_token` from a URL hash fragment (`#pin_token=...`).
 * Returns normalized 64-char lowercase hex string, or `null` if absent/invalid.
 */
export function extractRecipientTokenFromHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const candidate = params.get('pin_token');
  if (!candidate) return null;

  const normalized = candidate.trim().toLowerCase();
  return RECIPIENT_TOKEN_REGEX.test(normalized) ? normalized : null;
}

/**
 * Immediately strips the `#pin_token=...` fragment from the browser address bar
 * without triggering a navigation reload.
 */
export function scrubUrlHashFragment(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) {
    return;
  }
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', cleanUrl);
}

/**
 * Stores a validated recipient token in tab-scoped `sessionStorage` so page
 * refreshes within the same tab keep working after `scrubUrlHashFragment()`.
 */
export function saveRecipientTokenForSession(trackingCode: string, token: string): void {
  const normalized = token.trim().toLowerCase();
  if (!trackingCode.trim() || !RECIPIENT_TOKEN_REGEX.test(normalized)) {
    return;
  }
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(normalizeSessionKey(trackingCode), normalized);
    }
  } catch {
    // Ignore storage quota / privacy mode errors; in-memory state still works.
  }
}

export function getRecipientTokenForSession(trackingCode: string): string | null {
  if (!trackingCode.trim()) return null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = window.sessionStorage.getItem(normalizeSessionKey(trackingCode));
      return isValidRecipientToken(stored) ? stored.trim().toLowerCase() : null;
    }
  } catch {
    // Ignore storage access errors.
  }
  return null;
}

export function clearRecipientTokenForSession(trackingCode: string): void {
  if (!trackingCode.trim()) return;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(normalizeSessionKey(trackingCode));
    }
  } catch {
    // Ignore storage access errors.
  }
}
