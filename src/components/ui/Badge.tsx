import React from 'react';
import type { DeliveryStatus } from '../../types';
import './Badge.css';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'info' | 'error' | 'brand';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
}) => {
  return (
    <span className={`of-badge of-badge-${variant} of-badge-${size} ${className}`}>
      {children}
    </span>
  );
};

export const DeliveryStatusBadge: React.FC<{ status: DeliveryStatus; className?: string }> = ({
  status,
  className = '',
}) => {
  const config = {
    created: { label: 'Request Created', variant: 'warning' as const },
    matched: { label: 'Provider Matched', variant: 'info' as const },
    in_transit: { label: 'In Transit', variant: 'brand' as const },
    delivered: { label: 'Delivered', variant: 'success' as const },
  }[status];

  return <Badge variant={config.variant} className={className}>{config.label}</Badge>;
};
