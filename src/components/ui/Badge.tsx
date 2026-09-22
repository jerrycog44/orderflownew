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
  const configMap: Record<DeliveryStatus, { label: string; variant: BadgeProps['variant'] }> = {
    draft: { label: 'Draft', variant: 'neutral' },
    searching: { label: 'Finding Logistics', variant: 'info' },
    opportunity_sent: { label: 'Dispatch Sent', variant: 'brand' },
    created: { label: 'Request Created', variant: 'warning' },
    provider_selected: { label: 'Provider Selected', variant: 'info' },
    awaiting_pickup: { label: 'Awaiting Pickup', variant: 'warning' },
    picked_up: { label: 'Picked Up', variant: 'info' },
    in_transit: { label: 'In Transit', variant: 'brand' },
    delivered: { label: 'Delivered', variant: 'success' },
    cancelled: { label: 'Cancelled', variant: 'error' },
  };

  const config = configMap[status] || { label: status, variant: 'neutral' };

  return <Badge variant={config.variant} className={className}>{config.label}</Badge>;
};
