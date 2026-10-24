import React from 'react';
import './StatusFilterPills.css';

export interface FilterPillItem {
  key: string;
  label: string;
  count?: number;
}

export interface StatusFilterPillsProps {
  items: FilterPillItem[];
  selectedKey: string;
  onSelect: (key: string) => void;
  className?: string;
}

export const StatusFilterPills: React.FC<StatusFilterPillsProps> = ({
  items,
  selectedKey,
  onSelect,
  className = '',
}) => {
  return (
    <div
      className={`of-m-pills-container ${className}`}
      role="tablist"
      aria-label="Filter status tabs"
      data-testid="status-filter-pills"
    >
      {items.map((item) => {
        const isSelected = item.key === selectedKey;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isSelected}
            className={`of-m-pill ${isSelected ? 'is-selected' : ''}`}
            onClick={() => onSelect(item.key)}
            data-testid={`filter-pill-${item.key}`}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className="of-m-pill-count" data-testid={`count-${item.key}`}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
