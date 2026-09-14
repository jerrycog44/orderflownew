import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Menu, X, ArrowRight, Truck, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../auth/AuthContext';
import './Navbar.css';

interface NavbarProps {
  onOpenVendorOnboarding?: () => void;
  onOpenLogisticsOnboarding?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenVendorOnboarding,
  onOpenLogisticsOnboarding,
}) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }, [mobileMenuOpen]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/#' + id);
    }
  };

  const handleVendorClick = () => {
    if (onOpenVendorOnboarding) {
      onOpenVendorOnboarding();
    } else {
      navigate('/signup?role=vendor');
    }
  };

  const handleLogisticsClick = () => {
    if (onOpenLogisticsOnboarding) {
      onOpenLogisticsOnboarding();
    } else {
      navigate('/signup?role=logistics_provider');
    }
  };

  return (
    <header className={`of-navbar ${scrolled ? 'of-navbar-scrolled' : ''}`}>
      <div className="container of-navbar-container">
        {/* Logo */}
        <Link to="/" className="of-logo" aria-label="OrderFlow Home">
          <div className="of-logo-icon">
            <Truck size={20} color="#FFFFFF" />
          </div>
          <span className="of-logo-text">
            Order<span className="of-logo-accent">Flow</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <nav className="of-nav-desktop" aria-label="Main Navigation">
          <button onClick={() => scrollToSection('how-it-works')} className="of-nav-link">
            How It Works
          </button>
          <button onClick={() => scrollToSection('whatsapp-integration')} className="of-nav-link">
            WhatsApp & Web
          </button>
          <button onClick={() => scrollToSection('logistics-providers')} className="of-nav-link">
            For Providers
          </button>
        </nav>

        {/* Desktop Actions */}
        <div className="of-nav-actions-desktop">
          {isAuthenticated ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(
                    user?.role === 'vendor' ? '/dashboard/vendor' : '/dashboard/provider'
                  )
                }
                leftIcon={<User size={16} />}
              >
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Sign in
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleVendorClick}
                rightIcon={<ArrowRight size={16} />}
              >
                Get started
              </Button>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          className="of-mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="of-mobile-drawer" role="dialog" aria-modal="true">
            <div className="of-mobile-drawer-content">
              <nav className="of-mobile-nav">
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="of-mobile-nav-link"
                >
                  How It Works
                </button>
                <button
                  onClick={() => scrollToSection('whatsapp-integration')}
                  className="of-mobile-nav-link"
                >
                  WhatsApp & Web
                </button>
                <button
                  onClick={() => scrollToSection('logistics-providers')}
                  className="of-mobile-nav-link"
                >
                  For Providers
                </button>
              </nav>

              <div className="of-mobile-drawer-actions">
                {isAuthenticated ? (
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate(
                        user?.role === 'vendor' ? '/dashboard/vendor' : '/dashboard/provider'
                      );
                    }}
                  >
                    Go to Dashboard
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="md"
                      className="w-full"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogisticsClick();
                      }}
                    >
                      Become a provider
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleVendorClick();
                      }}
                      rightIcon={<ArrowRight size={16} />}
                    >
                      Get started
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
