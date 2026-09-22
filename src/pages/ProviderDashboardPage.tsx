import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, LogOut, MapPin, Navigation, CheckCircle2, PackageCheck, Phone, User as UserIcon, XCircle, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { deliveryService } from '../services/deliveryService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import type { LogisticsProviderProfile, DeliveryRecord, DeliveryStatus, ProviderAvailability } from '../types';

export const ProviderDashboardPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'opportunities' | 'assigned'>('opportunities');
  const [selectedJob, setSelectedJob] = useState<DeliveryRecord | null>(null);

  const providerId = user?.id || 'prov_swifthaul';

  // Availability state
  const [availability, setAvailability] = useState<ProviderAvailability>(() => {
    const saved = localStorage.getItem(`of_dev_availability_${providerId}`);
    return (saved as ProviderAvailability) || 'available';
  });

  // Lazy initialize profile
  const [profile] = useState<LogisticsProviderProfile | null>(() => {
    if (user?.id) {
      try {
        const raw = localStorage.getItem('of_dev_provider_profiles');
        if (raw) {
          const profiles: Record<string, LogisticsProviderProfile> = JSON.parse(raw);
          return profiles[user.id] || null;
        }
      } catch {
        // ignore parse error
      }
    }
    return null;
  });

  const providerName = profile?.providerName || user?.fullName || 'SwiftHaul Express';

  const [targetedOpportunity, setTargetedOpportunity] = useState<DeliveryRecord | null>(() => {
    return deliveryService.getProviderTargetedOpportunity(providerId);
  });

  const [opportunities, setOpportunities] = useState<DeliveryRecord[]>(() => {
    return deliveryService.getProviderOpportunities(profile?.coverageArea);
  });

  const [assignedDeliveries, setAssignedDeliveries] = useState<DeliveryRecord[]>(() => {
    return deliveryService.getProviderAssignedDeliveries(providerId);
  });

  const refreshData = () => {
    setTargetedOpportunity(deliveryService.getProviderTargetedOpportunity(providerId));
    setOpportunities(deliveryService.getProviderOpportunities(profile?.coverageArea));
    setAssignedDeliveries(deliveryService.getProviderAssignedDeliveries(providerId));
  };

  const handleAvailabilityChange = (newStatus: ProviderAvailability) => {
    setAvailability(newStatus);
    localStorage.setItem(`of_dev_availability_${providerId}`, newStatus);

    const statusLabels: Record<ProviderAvailability, string> = {
      available: 'Online & Available for Dispatches',
      busy: 'Busy (High Active Dispatch Load)',
      unavailable: 'Offline / Unavailable',
    };

    addToast({
      title: 'Availability Status Updated',
      description: `Your status is now ${statusLabels[newStatus]}.`,
      type: newStatus === 'available' ? 'success' : newStatus === 'busy' ? 'warning' : 'info',
    });
    refreshData();
  };

  const handleAcceptJob = (job: DeliveryRecord) => {
    const updated = deliveryService.acceptDelivery(job.id, providerId, providerName);
    if (updated) {
      addToast({
        title: 'Dispatch Accepted!',
        description: `Delivery ${job.id} is now assigned to your fleet queue.`,
        type: 'success',
      });
      setSelectedJob(null);
      refreshData();
      setActiveTab('assigned');
    }
  };

  const handleDeclineJob = (jobId: string) => {
    deliveryService.declineOpportunity(jobId, providerId);
    addToast({
      title: 'Opportunity Declined',
      description: `OrderFlow has routed delivery ${jobId} to the next eligible provider candidate.`,
      type: 'info',
    });
    setSelectedJob(null);
    refreshData();
  };

  const handleUpdateStatus = (jobId: string, newStatus: DeliveryStatus) => {
    const updated = deliveryService.updateDeliveryStatus(jobId, newStatus);
    if (updated) {
      const statusLabels: Record<string, string> = {
        in_transit: 'In Transit',
        delivered: 'Delivered',
        awaiting_pickup: 'Awaiting Pickup',
      };
      addToast({
        title: 'Status Updated',
        description: `Delivery ${jobId} status updated to ${statusLabels[newStatus] || newStatus}.`,
        type: 'info',
      });
      refreshData();
    }
  };

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div style={{ maxWidth: '1140px', margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
      {/* Top Banner Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
          paddingBottom: 'var(--space-6)',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Logistics Provider Dashboard
            </h1>
            <Badge variant="brand">Logistics Provider</Badge>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Welcome back, <strong>{providerName}</strong>. Manage your dispatches and real-time fleet availability.
          </p>
        </div>

        {/* Interactive Provider Availability Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-full)',
              padding: '3px',
            }}
          >
            <button
              type="button"
              onClick={() => handleAvailabilityChange('available')}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: availability === 'available' ? '#10B981' : 'transparent',
                color: availability === 'available' ? '#ffffff' : 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background var(--transition-fast), color var(--transition-fast)',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: availability === 'available' ? '#ffffff' : '#10B981', transition: 'background var(--transition-fast)' }} />
              Online
            </button>

            <button
              type="button"
              onClick={() => handleAvailabilityChange('busy')}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: availability === 'busy' ? '#F59E0B' : 'transparent',
                color: availability === 'busy' ? '#ffffff' : 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background var(--transition-fast), color var(--transition-fast)',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: availability === 'busy' ? '#ffffff' : '#F59E0B', transition: 'background var(--transition-fast)' }} />
              Busy
            </button>

            <button
              type="button"
              onClick={() => handleAvailabilityChange('unavailable')}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: availability === 'unavailable' ? '#6B7280' : 'transparent',
                color: availability === 'unavailable' ? '#ffffff' : 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background var(--transition-fast), color var(--transition-fast)',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: availability === 'unavailable' ? '#ffffff' : '#9CA3AF', transition: 'background var(--transition-fast)' }} />
              Offline
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut size={16} style={{ marginRight: '6px' }} />
            Sign out
          </Button>
        </div>
      </div>

      {/* Targeted Incoming Opportunity Alert Card */}
      {targetedOpportunity && availability !== 'unavailable' && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(16, 185, 129, 0.06))',
            border: '2px solid var(--color-brand-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            marginBottom: 'var(--space-6)',
            boxShadow: '0 4px 16px rgba(37, 99, 235, 0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Badge variant="brand">NEW TARGETED DISPATCH OPPORTUNITY</Badge>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-accent)' }}>
                {targetedOpportunity.id}
              </span>
            </div>

            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                color: '#10B981',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#10B981',
                  display: 'inline-block',
                  animation: 'pulse 1.5s infinite',
                }}
              />
              New Opportunity
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 2px 0' }}>
                {targetedOpportunity.productName}
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Vendor: <strong>{targetedOpportunity.vendorName}</strong> • {targetedOpportunity.package.weightKg} kg ({targetedOpportunity.package.packageType})
              </p>
            </div>

            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-accent)', fontWeight: 700 }}>PICKUP:</span>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {targetedOpportunity.pickup.address} ({targetedOpportunity.pickup.city})
              </p>
            </div>

            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: '#10B981', fontWeight: 700 }}>DROP-OFF:</span>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {targetedOpportunity.destination.address} ({targetedOpportunity.destination.city})
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Payout
              </span>
              <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: '#10B981', margin: 0 }}>
                ₦{targetedOpportunity.estimatedPrice.toLocaleString()}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeclineJob(targetedOpportunity.id)}
              leftIcon={<XCircle size={16} color="var(--color-warning)" />}
            >
              Decline Opportunity
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleAcceptJob(targetedOpportunity)}
              leftIcon={<CheckCircle2 size={16} />}
            >
              Accept Dispatch
            </Button>
          </div>
        </div>
      )}

      {/* Offline Alert if Unavailable */}
      {availability === 'unavailable' && (
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            background: 'var(--color-bg-subtle)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <AlertCircle size={20} color="var(--color-text-tertiary)" />
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            You are currently <strong>Offline</strong>. Switch status to <strong>Online</strong> to receive OrderFlow dispatch opportunities.
          </p>
        </div>
      )}

      {/* Grid Layout — responsive: 2-col on wide, 1-col on mobile */}
      <div className="of-provider-grid">
        {/* Main Section */}
        <div>
          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--color-border-default)' }}>
            <button
              onClick={() => setActiveTab('opportunities')}
              style={{
                padding: 'var(--space-3) var(--space-4)',
                fontWeight: 600,
                fontSize: 'var(--font-size-sm)',
                color: activeTab === 'opportunities' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                borderBottom: activeTab === 'opportunities' ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
                background: 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              Available Opportunities ({opportunities.length})
            </button>
            <button
              onClick={() => setActiveTab('assigned')}
              style={{
                padding: 'var(--space-3) var(--space-4)',
                fontWeight: 600,
                fontSize: 'var(--font-size-sm)',
                color: activeTab === 'assigned' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                borderBottom: activeTab === 'assigned' ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
                background: 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              My Active Deliveries ({assignedDeliveries.length})
            </button>
          </div>

          {/* Tab 1: Available Opportunities */}
          {activeTab === 'opportunities' && (
            <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                    Open Delivery Requests
                  </h2>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    Requests waiting for last-mile pickup in {profile?.coverageArea || 'your service area'}
                  </span>
                </div>
                <Badge variant="success">{opportunities.length} Open</Badge>
              </div>

              {opportunities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
                  <Truck size={36} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-2)' }} />
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    No open delivery requests
                  </h3>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    New vendor orders will populate here automatically.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {opportunities.map((opp) => (
                    <div
                      key={opp.id}
                      style={{
                        background: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-4)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '2px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-accent)' }}>
                              {opp.id}
                            </span>
                            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                              {opp.productName}
                            </h3>
                          </div>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            Vendor: {opp.vendorName} • {opp.package.weightKg} kg ({opp.package.packageType})
                          </span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                            Payout
                          </span>
                          <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: '#10B981', margin: 0 }}>
                            ₦{opp.estimatedPrice.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)', background: 'var(--color-bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={14} color="var(--color-brand-accent)" />
                          <span><strong>Pickup:</strong> {opp.pickup.address} ({opp.pickup.city})</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Navigation size={14} color="#10B981" />
                          <span><strong>Dropoff:</strong> {opp.destination.address} ({opp.destination.city})</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setSelectedJob(opp)}
                        >
                          View & Accept Job
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: My Active Deliveries */}
          {activeTab === 'assigned' && (
            <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                    My Active Dispatches
                  </h2>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    Deliveries assigned to your fleet
                  </span>
                </div>
                <Badge variant="info">{assignedDeliveries.length} Active</Badge>
              </div>

              {assignedDeliveries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
                  <Clock size={36} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-2)' }} />
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    No active dispatches
                  </h3>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    Accept requests from the Available Opportunities tab to get started.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {assignedDeliveries.map((job) => (
                    <div
                      key={job.id}
                      style={{
                        background: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-4)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-accent)' }}>
                            {job.id}
                          </span>
                          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                            {job.productName}
                          </h3>
                        </div>
                      <Badge
                          variant={
                            job.status === 'delivered'
                              ? 'success'
                              : job.status === 'in_transit'
                              ? 'brand'
                              : 'warning'
                          }
                        >
                          {job.status === 'delivered'
                            ? 'Delivered'
                            : job.status === 'in_transit'
                            ? 'In Transit'
                            : job.status === 'provider_selected'
                            ? 'Matched'
                            : job.status === 'awaiting_pickup'
                            ? 'Awaiting Pickup'
                            : job.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Badge>
                      </div>

                      <div style={{ fontSize: 'var(--font-size-xs)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                        <div>
                          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                            <strong>Pickup:</strong> {job.pickup.address} ({job.pickup.contactPhone || 'N/A'})
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                            <strong>Recipient:</strong> {job.recipient.name} ({job.recipient.phone})
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)' }}>
                        {job.status !== 'in_transit' && job.status !== 'delivered' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleUpdateStatus(job.id, 'in_transit')}
                            leftIcon={<Truck size={14} />}
                          >
                            Mark In Transit
                          </Button>
                        )}
                        {job.status !== 'delivered' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleUpdateStatus(job.id, 'delivered')}
                            leftIcon={<CheckCircle2 size={14} />}
                          >
                            Mark Delivered
                          </Button>
                        )}
                        {job.status === 'delivered' && (
                          <span style={{ fontSize: 'var(--font-size-xs)', color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <PackageCheck size={16} /> Order Completed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Provider Profile Details Card */}
        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', height: 'fit-content' }}>
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Truck size={18} color="var(--color-brand-accent)" />
            Service Profile
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Company / Service Name
              </span>
              <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {providerName}
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Type & Availability
              </span>
              <p style={{ color: 'var(--color-text-primary)', margin: '2px 0 0 0', textTransform: 'capitalize' }}>
                {profile?.providerType || 'courier'} • <span style={{ color: '#10B981', fontWeight: 600 }}>Available</span>
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Coverage Area
              </span>
              <p style={{ color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {profile?.coverageArea || 'Ibadan'}
              </p>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Fleet Vehicles
              </span>
              <p style={{ color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                {profile?.vehicleTypes && profile.vehicleTypes.length > 0 ? profile.vehicleTypes.join(', ') : 'Motorcycle, Delivery Van'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Job Details & Acceptance */}
      <Modal
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title={`Delivery Details (${selectedJob?.id})`}
        maxWidth="lg"
      >
        {selectedJob && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {selectedJob.productName}
              </h4>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Vendor: <strong>{selectedJob.vendorName}</strong> | Weight: {selectedJob.package.weightKg} kg
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
              <div style={{ border: '1px solid var(--color-border-default)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={14} /> PICKUP LOCATION
                </span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 600 }}>{selectedJob.pickup.address}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{selectedJob.pickup.city}</p>
                {selectedJob.pickup.contactPhone && (
                  <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={12} /> {selectedJob.pickup.contactPhone}
                  </p>
                )}
              </div>

              <div style={{ border: '1px solid var(--color-border-default)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: '#10B981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Navigation size={14} /> DROP-OFF DESTINATION
                </span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 600 }}>{selectedJob.destination.address}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{selectedJob.destination.city}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <UserIcon size={12} /> {selectedJob.recipient.name} ({selectedJob.recipient.phone})
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-default)' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Estimated Payout</span>
                <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: '#10B981', margin: 0 }}>
                  ₦{selectedJob.estimatedPrice.toLocaleString()}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="outline" onClick={() => setSelectedJob(null)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => handleAcceptJob(selectedJob)}>
                  Accept Dispatch
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

