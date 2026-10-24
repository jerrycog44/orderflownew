/**
 * OrderFlow Mobile Delivery Status Helpers
 * Semantic status configuration mapping for mobile badges and chips
 */

export interface StatusBadgeConfig {
  label: string;
  className: string;
}

export function getStatusBadgeConfig(status?: string): StatusBadgeConfig {
  if (!status) return { label: 'Pending', className: 'of-m-status-warning' };

  switch (status.toLowerCase()) {
    case 'delivered':
      return { label: 'Delivered', className: 'of-m-status-success' };
    case 'in_transit':
    case 'picked_up':
      return { label: 'In Transit', className: 'of-m-status-info' };
    case 'provider_assigned':
    case 'matched':
    case 'provider_accepted':
      return { label: 'Assigned', className: 'of-m-status-info' };
    case 'searching_provider':
      return { label: 'Searching Dispatch', className: 'of-m-status-warning' };
    case 'pending':
    case 'order_created':
      return { label: 'Pending Offer', className: 'of-m-status-warning' };
    case 'cancelled':
    case 'delivery_failed':
      return { label: 'Cancelled', className: 'of-m-status-error' };
    default:
      return {
        label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        className: 'of-m-status-info',
      };
  }
}
