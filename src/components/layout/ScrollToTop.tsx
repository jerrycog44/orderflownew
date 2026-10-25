import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop component
 * Automatically scrolls the window to top (0,0) whenever the route path changes.
 * Fixes SPA scroll restoration bugs where navigating to new routes leaves
 * the viewport scrolled down at the footer.
 *
 * If navigation carries `state.scrollTo` (set by the landing navbar/footer when
 * invoked from another public page), it scrolls to that section instead.
 */
export function ScrollToTop() {
  const { pathname, key, state } = useLocation();

  useEffect(() => {
    const target = (state as { scrollTo?: string } | null)?.scrollTo;
    if (target) {
      const timer = window.setTimeout(() => {
        const el = document.getElementById(target);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo(0, 0);
        }
      }, 60);
      return () => window.clearTimeout(timer);
    }
    window.scrollTo(0, 0);
  }, [pathname, key, state]);

  return null;
}
