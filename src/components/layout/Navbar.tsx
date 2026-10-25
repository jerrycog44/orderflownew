import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Menu, X, ArrowRight, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { OrderFlowLogo } from '../ui/OrderFlowLogo';
import { useAuth } from '../../auth/AuthContext';
import { useLandingActions } from '../../lib/landingActions';
import './Navbar.css';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, signOut } = useAuth();
  const { dashboardPath, openWebApp, goToSection } = useLandingActions();
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
    return () => document.body.classList.remove('modal-open');
  }, [mobileMenuOpen]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    goToSection(id);
  };

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
  };

  return (
    <header className={`of-navbar ${scrolled ? 'of-navbar-scrolled' : ''}`}>
      <div className="container of-navbar-container">
        {/* Brand Logo */}
        <Link to="/" className="of-logo" aria-label="OrderFlow Home">
          <OrderFlowLogo size={30} variant="light" showText={true} />
        </Link>

        {/* Desktop Navigation */}
        <nav className="of-nav-desktop" aria-label="Main Navigation">
          <button onClick={() => scrollToSection('how-it-works')} className="of-nav-link">
            How It Works
          </button>
          <button onClick={() => scrollToSection('features')} className="of-nav-link">
            Features
          </button>
          <button onClick={() => scrollToSection('logistics-providers')} className="of-nav-link">
            For Providers
          </button>
          <Link to="/track" className="of-nav-link">
            Track Order
          </Link>
        </nav>

        {/* Desktop Actions */}
        <div className="of-nav-actions-desktop">
          {isAuthenticated ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(dashboardPath ?? '/login')}
                leftIcon={<User size={15} />}
              >
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Sign in
              </Button>
              <Button variant="primary" size="sm" onClick={openWebApp} rightIcon={<ArrowRight size={15} />}>
                Use on Web
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
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="of-mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div className="of-mobile-drawer-content">
              <nav className="of-mobile-nav">
                <button onClick={() => scrollToSection('how-it-works')} className="of-mobile-nav-link">
                  How It Works
                </button>
                <button onClick={() => scrollToSection('features')} className="of-mobile-nav-link">
                  Features
                </button>
                <button onClick={() => scrollToSection('logistics-providers')} className="of-mobile-nav-link">
                  For Providers
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/track');
                  }}
                  className="of-mobile-nav-link"
                >
                  Track Order
                </button>
              </nav>

              <div className="of-mobile-drawer-actions">
                {isAuthenticated ? (
                  <>
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate(dashboardPath ?? '/login');
                      }}
                    >
                      Go to Dashboard
                    </Button>
                    <Button variant="ghost" size="md" className="w-full" onClick={handleSignOut}>
                      Sign out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="md"
                      className="w-full"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate('/login');
                      }}
                    >
                      Sign in
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        openWebApp();
                      }}
                      rightIcon={<ArrowRight size={16} />}
                    >
                      Use on Web
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
