import React from 'react';

export const PageLoader: React.FC = () => {
  return (
    <div
      role="status"
      aria-label="Loading page content"
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-8)',
      }}
    >
      <div
        style={{
          width: '42px',
          height: '42px',
          border: '3px solid rgba(15, 23, 42, 0.08)',
          borderTopColor: 'var(--color-brand-accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span
        style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: 600,
          color: 'var(--color-text-tertiary)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Loading OrderFlow...
      </span>
    </div>
  );
};
