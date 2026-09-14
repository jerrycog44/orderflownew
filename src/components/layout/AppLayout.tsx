import React from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { Truck, LogOut, LayoutDashboard, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import './AppLayout.css';

/**
 * AppLayout component
 * Reusable layout shell for authenticated application pages (/vendor/dashboard, /logistics/dashboard).
 * Includes application header and user profile navigation.
 * Does NOT render the public marketing footer.
 */
export const AppLayout: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  const isVendor = user?.role === 'vendor';

  return (
    <div className="of-app-layout">
      {/* Authenticated Application Header */}
      <header className="of-app-header">
        <div className="container of-app-header-container">
          <div className="of-app-header-left">
            <Link
              to={isVendor ? '/vendor/dashboard' : '/logistics/dashboard'}
              className="of-logo"
              aria-label="OrderFlow App Dashboard"
            >
              <div className="of-logo-icon">
                <Truck size={18} color="#FFFFFF" />
              </div>
              <span className="of-logo-text">
                Order<span className="of-logo-accent">Flow</span>
              </span>
            </Link>

            <Badge variant="brand" className="of-app-workspace-badge">
              {isVendor ? 'Vendor Workspace' : 'Logistics Provider Workspace'}
            </Badge>
          </div>

          <nav className="of-app-nav">
            <Link
              to={isVendor ? '/vendor/dashboard' : '/logistics/dashboard'}
              className="of-app-nav-link active"
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </Link>
          </nav>

          <div className="of-app-header-right">
            {user && (
              <div className="of-app-user-info">
                <div className="of-app-user-avatar">
                  <UserIcon size={16} />
                </div>
                <div className="of-app-user-details">
                  <span className="of-app-user-name">{user.fullName}</span>
                  <span className="of-app-user-email">{user.email}</span>
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut size={16} style={{ marginRight: '6px' }} />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Authenticated Application Area */}
      <main id="app-main-content">
        <Outlet />
      </main>
    </div>
  );
};
