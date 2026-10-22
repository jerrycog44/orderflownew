import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TermsPage } from '../TermsPage';
import { PrivacyPage } from '../PrivacyPage';
import { NotFoundPage } from '../NotFoundPage';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';

describe('Phase 1: Compliance, Stability & Missing Routes', () => {
  it('renders Terms of Service with commercial logistics clauses', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /Terms of Service/i })).toBeInTheDocument();
    expect(screen.getByText(/Commercial Agreement/i)).toBeInTheDocument();
    expect(screen.getByText(/Prohibited & Restricted Items/i)).toBeInTheDocument();
    expect(screen.getByText(/Proof of Delivery \(POD\) & Handover Verification/i)).toBeInTheDocument();
    expect(screen.getByText(/legal@orderflow.ng/i)).toBeInTheDocument();
  });

  it('renders Privacy Policy with PII protection and NDPR compliance details', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /Privacy Policy/i })).toBeInTheDocument();
    expect(screen.getByText(/NDPR & GDPR Compliant/i)).toBeInTheDocument();
    expect(screen.getByText(/Public Tracking Security & PII Protection/i)).toBeInTheDocument();
    expect(screen.getByText(/Recipient Phone & Address/i)).toBeInTheDocument();
    expect(screen.getByText(/privacy@orderflow.ng/i)).toBeInTheDocument();
  });

  it('renders 404 Not Found Page with tracking lookup form', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Error 404/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Page Not Found/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search tracking code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Track/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Return Home/i })).toBeInTheDocument();
  });

  it('ErrorBoundary renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Application Working Normal</div>
      </ErrorBoundary>
    );

    expect(screen.getByText(/Application Working Normal/i)).toBeInTheDocument();
  });

  it('ErrorBoundary catches unexpected child throw and displays graceful recovery UI', () => {
    const ProblematicComponent = () => {
      throw new Error('Simulated runtime crash');
    };

    // Suppress console.error in vitest output for intentional error throw
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblematicComponent />
      </ErrorBoundary>
    );

    expect(screen.getByRole('heading', { level: 1, name: /Something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred in OrderFlow/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload Page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to Home/i })).toBeInTheDocument();
    expect(screen.getByText(/Simulated runtime crash/i)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
