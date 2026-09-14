import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop component
 * Automatically scrolls the window to top (0,0) whenever the route path changes.
 * Fixes SPA scroll restoration bugs where navigating to new routes leaves
 * the viewport scrolled down at the footer.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
