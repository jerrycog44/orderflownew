import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Home, Search, LayoutDashboard } from 'lucide-react';
import { useOptionalAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/Button';
import './NotFoundPage.css';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useOptionalAuth();
  const user = auth?.user;
  const [trackingInput, setTrackingInput] = useState('');

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = trackingInput.trim();
    if (clean) {
      navigate(`/track/${clean}`);
    }
  };

  const dashboardPath = user?.role === 'logistics_provider'
    ? '/logistics/dashboard'
    : '/vendor/dashboard';

  return (
    <div className="of-notfound-page">
      <div className="of-notfound-card">
        <div className="of-notfound-icon-wrap">
          <Compass size={36} />
        </div>

        <div className="of-notfound-code">Error 404</div>
        <h1 className="of-notfound-title">Page Not Found</h1>
        <p className="of-notfound-desc">
          The link you followed may be broken, the page may have been moved, 
          or the tracking number entered is invalid.
        </p>

        {/* Quick Tracking Search Form */}
        <form onSubmit={handleTrackSubmit} className="of-notfound-search">
          <input
            type="text"
            className="of-notfound-search-input"
            placeholder="Search tracking code (e.g. OF-IBD-9042)"
            value={trackingInput}
            onChange={(e) => setTrackingInput(e.target.value)}
          />
          <Button type="submit" variant="primary" size="md">
            <Search size={16} style={{ marginRight: '6px' }} />
            Track
          </Button>
        </form>

        {/* Action Buttons */}
        <div className="of-notfound-actions">
          <Button variant="outline" size="md" onClick={() => navigate('/')}>
            <Home size={16} style={{ marginRight: '6px' }} />
            Return Home
          </Button>

          {user && (
            <Button variant="primary" size="md" onClick={() => navigate(dashboardPath)}>
              <LayoutDashboard size={16} style={{ marginRight: '6px' }} />
              Go to Dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
