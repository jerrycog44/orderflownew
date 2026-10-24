import React from 'react';
import { ChevronRight, Package, AlertTriangle } from 'lucide-react';
import type { DeliveryRecord, DeliveryStatus } from '../../types';
import { getStatusBadgeConfig } from './deliveryStatusHelpers';
import './DeliveryJobCard.css';

export interface DeliveryJobCardProps {
  delivery?: DeliveryRecord;
  trackingCode?: string;
  status?: DeliveryStatus | string;
  pickupAddress?: string;
  pickupCity?: string;
  destinationAddress?: string;
  destinationCity?: string;
  productName?: string;
  packageType?: string;
  weightKg?: number;
  isFragile?: boolean;
  estimatedPrice?: number;
  actionLabel?: string;
  onAction?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  className?: string;
}

export const DeliveryJobCard: React.FC<DeliveryJobCardProps> = ({
  delivery,
  trackingCode = delivery?.trackingCode || (delivery?.id ? delivery.id.slice(0, 8).toUpperCase() : 'OF-NEW'),
  status = delivery?.status || 'pending',
  pickupAddress = delivery?.pickup?.address,
  pickupCity = delivery?.pickup?.city || 'Origin',
  destinationAddress = delivery?.destination?.address,
  destinationCity = delivery?.destination?.city || 'Destination',
  productName = delivery?.productName || delivery?.package?.productName,
  packageType = delivery?.package?.packageType,
  weightKg = delivery?.package?.weightKg,
  isFragile = delivery?.package?.fragile,
  estimatedPrice = delivery?.estimatedPrice,
  actionLabel,
  onAction,
  onClick,
  className = '',
}) => {
  const statusConfig = getStatusBadgeConfig(status);

  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return '—';
    return `₦${price.toLocaleString()}`;
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAction) {
      onAction(e);
    }
  };

  return (
    <article
      className={`of-m-card ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : 'article'}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid={`delivery-job-card-${trackingCode}`}
    >
      {/* Header: Tracking Code & Status Badge */}
      <div className="of-m-card-header">
        <span className="of-m-card-tracking" data-testid="delivery-card-tracking">
          {trackingCode}
        </span>
        <span
          className={`of-m-status-pill ${statusConfig.className}`}
          data-testid="delivery-card-status"
        >
          <span className="of-m-status-dot" aria-hidden="true" />
          {statusConfig.label}
        </span>
      </div>

      {/* Visual Route Connector */}
      <div className="of-m-card-route">
        <div className="of-m-route-stop">
          <div className="of-m-route-indicator">
            <span className="of-m-route-dot pickup" aria-hidden="true" />
            <span className="of-m-route-connector" aria-hidden="true" />
          </div>
          <div className="of-m-route-details">
            <p className="of-m-route-label">Pickup</p>
            <p className="of-m-route-address" title={pickupAddress || pickupCity}>
              {pickupAddress ? `${pickupAddress}, ${pickupCity}` : pickupCity}
            </p>
          </div>
        </div>

        <div className="of-m-route-stop">
          <div className="of-m-route-indicator">
            <span className="of-m-route-dot destination" aria-hidden="true" />
          </div>
          <div className="of-m-route-details">
            <p className="of-m-route-label">Dropoff</p>
            <p className="of-m-route-address" title={destinationAddress || destinationCity}>
              {destinationAddress ? `${destinationAddress}, ${destinationCity}` : destinationCity}
            </p>
          </div>
        </div>
      </div>

      {/* Package Metadata */}
      {(productName || packageType || weightKg || isFragile) && (
        <div className="of-m-card-meta">
          {productName && (
            <span className="of-m-meta-pill">
              <Package size={13} />
              {productName}
            </span>
          )}
          {packageType && (
            <span className="of-m-meta-pill">
              {packageType}
            </span>
          )}
          {weightKg !== undefined && (
            <span className="of-m-meta-pill">
              {weightKg} kg
            </span>
          )}
          {isFragile && (
            <span className="of-m-meta-pill fragile">
              <AlertTriangle size={12} />
              Fragile
            </span>
          )}
        </div>
      )}

      {/* Card Footer: Price & Action */}
      <div className="of-m-card-footer">
        <div className="of-m-card-price-block">
          <span className="of-m-card-price-label">Estimated Fare</span>
          <span className="of-m-card-price-value" data-testid="delivery-card-price">
            {formatPrice(estimatedPrice)}
          </span>
        </div>

        <div className="of-m-card-action-block">
          {actionLabel ? (
            <button
              type="button"
              className="of-m-card-btn"
              onClick={handleActionClick}
              data-testid="delivery-card-action-btn"
            >
              {actionLabel}
            </button>
          ) : (
            onClick && <ChevronRight className="of-m-card-chevron" size={20} />
          )}
        </div>
      </div>
    </article>
  );
};
