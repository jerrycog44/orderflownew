import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, Plus, Search, User, Truck } from 'lucide-react';
import { useOptionalAuth } from '../../auth/AuthContext';
import './MobileBottomNav.css';

export interface NavItemConfig {
  id: string;
  label: string;
  path?: string;
  icon: React.ReactNode;
  badge?: number | string;
  isAction?: boolean;
  onClick?: () => void;
}

export interface MobileBottomNavProps {
  customItems?: NavItemConfig[];
  roleOverride?: 'vendor' | 'logistics_provider' | null;
  className?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  customItems,
  roleOverride,
  className = '',
}) => {
  const location = useLocation();
  const auth = useOptionalAuth();
  const currentRole = roleOverride !== undefined ? roleOverride : auth?.role ?? null;

  const defaultVendorItems: NavItemConfig[] = [
    {
      id: 'vendor-orders',
      label: 'Orders',
      path: '/vendor/dashboard',
      icon: <Package size={22} />,
    },
    {
      id: 'vendor-create',
      label: 'Create',
      path: '/vendor/deliveries/create',
      icon: <Plus size={24} strokeWidth={2.6} />,
      isAction: true,
    },
    {
      id: 'vendor-track',
      label: 'Track',
      path: '/track',
      icon: <Search size={22} />,
    },
    {
      id: 'vendor-profile',
      label: 'Profile',
      path: '/role-selection',
      icon: <User size={22} />,
    },
  ];

  const defaultProviderItems: NavItemConfig[] = [
    {
      id: 'provider-dispatches',
      label: 'Dispatches',
      path: '/logistics/dashboard',
      icon: <Truck size={22} />,
    },
    {
      id: 'provider-track',
      label: 'Track',
      path: '/track',
      icon: <Search size={22} />,
    },
    {
      id: 'provider-profile',
      label: 'Profile',
      path: '/role-selection',
      icon: <User size={22} />,
    },
  ];

  const defaultPublicItems: NavItemConfig[] = [
    {
      id: 'public-track',
      label: 'Track',
      path: '/track',
      icon: <Search size={22} />,
    },
    {
      id: 'public-login',
      label: 'Sign In',
      path: '/login',
      icon: <User size={22} />,
    },
  ];

  const navItems = customItems ?? (
    currentRole === 'vendor'
      ? defaultVendorItems
      : currentRole === 'logistics_provider'
      ? defaultProviderItems
      : defaultPublicItems
  );

  return (
    <nav
      className={`of-m-bottom-nav ${className}`}
      role="navigation"
      aria-label="Mobile Navigation"
      data-testid="mobile-bottom-nav"
    >
      <div className="of-m-bottom-nav-inner">
        {navItems.map((item) => {
          const isActive = item.path ? location.pathname === item.path : false;
          const activeClass = isActive ? 'is-active' : '';
          const actionClass = item.isAction ? 'is-action-tab' : '';

          const content = (
            <>
              {item.isAction ? (
                <div className="of-m-action-circle" aria-hidden="true">
                  {item.icon}
                </div>
              ) : (
                <div className="of-m-nav-item-icon-wrapper">
                  {item.icon}
                  {item.badge !== undefined && item.badge !== null && (
                    <span className="of-m-nav-badge" data-testid={`badge-${item.id}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
              <span className="of-m-nav-item-label">{item.label}</span>
            </>
          );

          if (item.onClick) {
            return (
              <button
                key={item.id}
                type="button"
                className={`of-m-nav-item ${activeClass} ${actionClass}`}
                onClick={item.onClick}
                aria-label={item.label}
                data-testid={`mobile-nav-${item.id}`}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              to={item.path || '#'}
              className={`of-m-nav-item ${activeClass} ${actionClass}`}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              data-testid={`mobile-nav-${item.id}`}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
