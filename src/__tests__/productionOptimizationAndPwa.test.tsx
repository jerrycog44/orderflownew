import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageLoader } from '../components/ui/PageLoader';
import manifest from '../../public/manifest.json';

describe('Phase 5: Production Optimization & PWA', () => {
  it('renders PageLoader with accessible loading state during code-split transitions', () => {
    render(<PageLoader />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Loading OrderFlow.../i)).toBeInTheDocument();
  });

  it('validates public/manifest.json conforms to PWA standalone standards', () => {
    expect(manifest.name).toBe('OrderFlow — Logistics Marketplace');
    expect(manifest.short_name).toBe('OrderFlow');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#0F172A');
    expect(manifest.theme_color).toBe('#0F172A');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(1);

    const hasAnyIcon = manifest.icons.some(
      (icon: { src: string }) => icon.src.includes('favicon.svg') || icon.src.includes('icon-')
    );
    expect(hasAnyIcon).toBe(true);
  });

  it('validates PWA shortcuts are configured for instant navigation', () => {
    expect(Array.isArray(manifest.shortcuts)).toBe(true);
    expect(manifest.shortcuts.length).toBeGreaterThanOrEqual(2);
    const urls = manifest.shortcuts.map((s: { url: string }) => s.url);
    expect(urls).toContain('/track');
    expect(urls).toContain('/vendor/deliveries/create');
  });
});

