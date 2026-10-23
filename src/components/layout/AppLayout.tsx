import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { Truck, LogOut, LayoutDashboard, User as UserIcon, Settings, ChevronDown, Repeat, Search } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { logisticsService } from '../../services/logisticsService';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import './AppLayout.css';

/**
 * AppLayout component
 * Reusable layout shell for authenticated application pages (/vendor/dashboard, /logistics/dashboard).
 * Includes sticky application header, workspace switcher, and interactive user profile/settings modal.
 */
export const AppLayout: React.FC = () => {
  const { user, signOut, setRole } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Profile edit form state
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [operatingCity, setOperatingCity] = useState('');
  const [coverageArea, setCoverageArea] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const isVendor = user?.role === 'vendor';

  // Load existing profile when opening modal
  useEffect(() => {
    if (profileModalOpen && user?.id) {
      if (isVendor) {
        logisticsService.getVendorProfile(user.id).then((p) => {
          if (p) {
            setBusinessName(p.businessName || '');
            setBusinessCategory(p.businessCategory || '');
            setOperatingCity(p.operatingCity || '');
          }
        });
      } else {
        logisticsService.getProviderProfile(user.id).then((p) => {
          if (p) {
            setBusinessName(p.providerName || '');
            setCoverageArea(p.coverageArea || '');
          }
        });
      }
    }
  }, [profileModalOpen, user?.id, isVendor]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [menuOpen]);

  const handleSignOut = () => {
    setMenuOpen(false);
    signOut();
    navigate('/login');
  };

  const handleRoleSwitch = async () => {
    setMenuOpen(false);
    const newRole = isVendor ? 'logistics_provider' : 'vendor';
    const { error } = await setRole(newRole);
    if (!error) {
      addToast({
        title: 'Switched Workspace',
        description: `You are now operating in the ${newRole === 'vendor' ? 'Vendor' : 'Logistics Provider'} workspace.`,
        type: 'info',
      });
      navigate(newRole === 'vendor' ? '/vendor/dashboard' : '/logistics/dashboard');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setIsSavingProfile(true);

    try {
      if (isVendor) {
        await logisticsService.updateVendorProfile(user.id, {
          businessName: businessName.trim(),
          businessCategory: businessCategory.trim(),
          operatingCity: operatingCity.trim(),
        });
      } else {
        await logisticsService.updateProviderProfile(user.id, {
          providerName: businessName.trim(),
          coverageArea: coverageArea.trim(),
        });
      }

      addToast({
        title: 'Profile Updated',
        description: 'Your workspace business details were saved successfully.',
        type: 'success',
      });
      setProfileModalOpen(false);
      // Dispatch custom event to notify active dashboard views to refresh
      window.dispatchEvent(new CustomEvent('of:profile-updated'));
    } catch (err) {
      console.error('Failed to update profile:', err);
      addToast({
        title: 'Update Failed',
        description: 'Unable to save profile changes. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

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
              {isVendor ? 'Vendor Workspace' : 'Logistics Provider'}
            </Badge>
          </div>

          <nav className="of-app-nav">
            <Link
              to={isVendor ? '/vendor/dashboard' : '/logistics/dashboard'}
              className="of-app-nav-link active"
            >
              <LayoutDashboard size={15} />
              <span>Dashboard</span>
            </Link>
            <Link to="/track" className="of-app-nav-link">
              <Search size={15} />
              <span>Track Order</span>
            </Link>
          </nav>

          <div className="of-app-header-right">
            {/* Interactive User Dropdown Menu */}
            <div className="of-app-user-menu-wrapper" ref={menuRef}>
              <button
                type="button"
                className={`of-app-user-trigger ${menuOpen ? 'is-open' : ''}`}
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-label="User Account Menu"
              >
                <div className="of-app-user-avatar">
                  <UserIcon size={16} />
                </div>
                {user && (
                  <div className="of-app-user-details">
                    <span className="of-app-user-name">{user.fullName}</span>
                    <span className="of-app-user-role">{isVendor ? 'Vendor' : 'Provider'}</span>
                  </div>
                )}
                <ChevronDown size={14} color="var(--color-text-tertiary)" style={{ marginLeft: '2px' }} />
              </button>

              {menuOpen && (
                <div className="of-app-user-dropdown" role="menu">
                  <div className="of-app-user-dropdown-header">
                    <p className="of-app-dropdown-name">{user?.fullName}</p>
                    <p className="of-app-dropdown-email">{user?.email}</p>
                    <Badge variant="neutral" style={{ fontSize: '10px' }}>
                      {isVendor ? 'Commercial Vendor' : 'Verified Logistics Fleet'}
                    </Badge>
                  </div>

                  <button
                    type="button"
                    className="of-app-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setProfileModalOpen(true);
                    }}
                  >
                    <Settings size={15} />
                    <span>Workspace Settings</span>
                  </button>

                  <button
                    type="button"
                    className="of-app-dropdown-item"
                    role="menuitem"
                    onClick={handleRoleSwitch}
                  >
                    <Repeat size={15} />
                    <span>Switch to {isVendor ? 'Provider' : 'Vendor'} View</span>
                  </button>

                  <div className="of-app-dropdown-divider" />

                  <button
                    type="button"
                    className="of-app-dropdown-item is-danger"
                    role="menuitem"
                    onClick={handleSignOut}
                  >
                    <LogOut size={15} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Authenticated Application Area */}
      <main id="app-main-content">
        <Outlet />
      </main>

      {/* Workspace Settings / Profile Edit Modal */}
      <Modal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title={isVendor ? 'Edit Business Profile' : 'Edit Logistics Provider Profile'}
        description="Update your trade name, location, and operational parameters."
        maxWidth="md"
      >
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            label={isVendor ? 'Business / Trading Name' : 'Company / Fleet Name'}
            type="text"
            placeholder={isVendor ? 'e.g. Apex Luxury & Retail' : 'e.g. SwiftHaul Express'}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
          />

          {isVendor ? (
            <>
              <Input
                label="Commercial Category"
                type="text"
                placeholder="e.g. Fashion & Apparel, Electronics"
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                required
              />
              <Input
                label="Operating City / Base Area"
                type="text"
                placeholder="e.g. Ibadan, Oyo State"
                value={operatingCity}
                onChange={(e) => setOperatingCity(e.target.value)}
                required
              />
            </>
          ) : (
            <Input
              label="Primary Coverage Territory"
              type="text"
              placeholder="e.g. Ibadan (Bodija, Ring Road, Dugbe)"
              value={coverageArea}
              onChange={(e) => setCoverageArea(e.target.value)}
              required
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <Button variant="outline" type="button" onClick={() => setProfileModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSavingProfile}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

