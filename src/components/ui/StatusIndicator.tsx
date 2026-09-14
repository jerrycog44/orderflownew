import React from 'react';

export interface StatusIndicatorProps {
  status: 'active' | 'pending' | 'completed' | 'offline';
  label?: string;
  pulse?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  pulse = false,
}) => {
  const colors = {
    active: 'var(--color-status-success-text)',
    pending: 'var(--color-status-warning-text)',
    completed: 'var(--color-status-info-text)',
    offline: 'var(--color-text-muted)',
  }[status];

  const dotBg = {
    active: '#22C55E',
    pending: '#F59E0B',
    completed: '#3B82F6',
    offline: '#94A3B8',
  }[status];

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: dotBg,
          boxShadow: pulse ? `0 0 0 3px ${dotBg}33` : 'none',
          display: 'inline-block',
        }}
      />
      {label && (
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: colors }}>
          {label}
        </span>
      )}
    </div>
  );
};
