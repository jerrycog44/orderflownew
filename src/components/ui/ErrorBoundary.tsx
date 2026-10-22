import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('OrderFlow Uncaught Application Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-bg-app)',
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              width: '100%',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-8) var(--space-6)',
              textAlign: 'center',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-5) auto',
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <h1
              style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                lineHeight: 'var(--line-height-relaxed)',
                marginBottom: 'var(--space-6)',
              }}
            >
              An unexpected error occurred in OrderFlow. Our team has been notified. 
              Please reload the page or return to the main dashboard.
            </p>

            {this.state.error && (
              <details
                style={{
                  marginBottom: 'var(--space-6)',
                  textAlign: 'left',
                  background: 'var(--color-bg-subtle)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  Error technical details
                </summary>
                <p style={{ marginTop: 'var(--space-2)', fontFamily: 'monospace', color: '#EF4444' }}>
                  {this.state.error.message}
                </p>
              </details>
            )}

            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Button variant="primary" size="md" onClick={this.handleReload}>
                <RefreshCw size={16} style={{ marginRight: '6px' }} />
                Reload Page
              </Button>
              <Button variant="outline" size="md" onClick={this.handleReset}>
                <Home size={16} style={{ marginRight: '6px' }} />
                Go to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
