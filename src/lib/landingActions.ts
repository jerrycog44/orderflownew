import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOptionalAuth } from '../auth/AuthContext';

/**
 * Public URL of the Android build (APK / Play Store listing).
 *
 * No Android build is published yet, so this is intentionally empty by default.
 * Set `VITE_ANDROID_APP_URL` at build time once a real download exists and the
 * landing page will automatically switch from a "Coming soon" state to a
 * working download link — no code change required.
 */
export const ANDROID_APP_URL: string = (import.meta.env.VITE_ANDROID_APP_URL as string | undefined)?.trim() ?? '';

export const isAndroidAppAvailable = ANDROID_APP_URL.length > 0;

/**
 * Shared navigation actions for the public landing page, navbar and footer.
 * Uses only existing routes (/signup, /login, dashboards, /track).
 */
export function useLandingActions() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useOptionalAuth();

  const dashboardPath = (() => {
    if (!auth?.isAuthenticated) return null;
    if (!auth.role) return '/role-selection';
    return auth.role === 'vendor' ? '/vendor/dashboard' : '/logistics/dashboard';
  })();

  /** Open the web app: dashboard when signed in, otherwise account creation. */
  const openWebApp = useCallback(() => {
    navigate(dashboardPath ?? '/signup');
  }, [navigate, dashboardPath]);

  const signUpAsVendor = useCallback(() => navigate('/signup?role=vendor'), [navigate]);
  const signUpAsProvider = useCallback(() => navigate('/signup?role=logistics_provider'), [navigate]);

  /**
   * Smooth-scroll to a landing section. When called from another public page
   * (e.g. /track) it navigates home first and ScrollToTop completes the scroll.
   */
  const goToSection = useCallback(
    (id: string) => {
      if (location.pathname === '/') {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        navigate('/', { state: { scrollTo: id } });
      }
    },
    [location.pathname, navigate]
  );

  return { dashboardPath, openWebApp, signUpAsVendor, signUpAsProvider, goToSection };
}
