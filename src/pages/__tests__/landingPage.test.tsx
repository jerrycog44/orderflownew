import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { HeroSection } from '../../components/sections/HeroSection';
import { HowItWorksSection } from '../../components/sections/HowItWorksSection';
import { FeaturesSection } from '../../components/sections/FeaturesSection';
import { TrustSection } from '../../components/sections/TrustSection';
import { LogisticsProviderSection } from '../../components/sections/LogisticsProviderSection';
import { GetAppSection } from '../../components/sections/GetAppSection';

const authState = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
  role: null,
  hasCompletedOnboarding: false,
  signOut: vi.fn(),
};

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => authState,
  useOptionalAuth: () => authState,
}));

const LocationProbe = () => {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
};

const renderLanding = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route
            path="/"
            element={
              <>
                <HeroSection />
                <HowItWorksSection />
                <FeaturesSection />
                <TrustSection />
                <LogisticsProviderSection />
                <GetAppSection />
              </>
            }
          />
        </Route>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );

describe('Landing page redesign', () => {
  afterEach(() => cleanup());

  it('contains no WhatsApp references anywhere on the page', () => {
    const { container } = renderLanding();
    expect(container.textContent?.toLowerCase()).not.toContain('whatsapp');
    expect(container.querySelector('a[href*="wa.me"], a[href*="whatsapp"]')).toBeNull();
  });

  it('renders a single h1 and the primary Use on Web / Download Android App CTAs', () => {
    renderLanding();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByTestId('cta-use-on-web').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('cta-download-android').length).toBeGreaterThanOrEqual(1);
  });

  it('does not pretend the Android app exists: button is disabled and marked Coming soon', () => {
    renderLanding();
    const androidButtons = screen.getAllByTestId('cta-download-android');
    androidButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
      expect(within(btn).getByText(/coming soon/i)).toBeInTheDocument();
    });
  });

  it('Use on Web routes unauthenticated visitors to /signup', () => {
    renderLanding();
    fireEvent.click(screen.getAllByTestId('cta-use-on-web')[0]);
    expect(screen.getByTestId('location')).toHaveTextContent('/signup');
  });

  it('provider and merchant CTAs go to role-specific signup', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: /become a provider/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/signup?role=logistics_provider');
  });

  it('preview tabs switch between create, dispatch and track screens', () => {
    renderLanding();
    expect(screen.getByRole('tab', { name: 'Create' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Dispatch' }));
    expect(screen.getByText('Smart Dispatch', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Track' }));
    expect(screen.getByText(/in transit/i)).toBeInTheDocument();
  });

  it('labels the product preview as illustrative', () => {
    renderLanding();
    expect(screen.getByText(/illustrative preview/i)).toBeInTheDocument();
  });

  it('footer links point at real routes only', () => {
    renderLanding();
    const footer = screen.getByRole('contentinfo');
    const hrefs = Array.from(footer.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    hrefs.forEach((href) => {
      expect(['/', '/track', '/login', '/privacy', '/terms']).toContain(href);
    });
  });
});
