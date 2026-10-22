import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  LogOut,
  MapPin,
  Navigation,
  CheckCircle2,
  PackageCheck,
  Phone,
  User as UserIcon,
  XCircle,
  AlertCircle,
  Clock,
  Camera,
  ShieldCheck,
  Banknote,
  Upload,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { deliveryService } from '../services/deliveryService';
import { logisticsService } from '../services/logisticsService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import type { LogisticsProviderProfile, DeliveryRecord, DeliveryStatus, ProviderAvailability } from '../types';
import './ProviderDashboardPage.css';

export const ProviderDashboardPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'opportunities' | 'assigned'>('opportunities');
  const [selectedJob, setSelectedJob] = useState<DeliveryRecord | null>(null);

  // Proof of Delivery (POD) modal state
  const [podModalJob, setPodModalJob] = useState<DeliveryRecord | null>(null);
  const [podPin, setPodPin] = useState('');
  const [podPhoto, setPodPhoto] = useState<string | undefined>(undefined);
  const [podError, setPodError] = useState<string | null>(null);
  const [isVerifyingPod, setIsVerifyingPod] = useState(false);

  const providerId = user?.id || 'prov_swifthaul';

  const [availability, setAvailability] = useState<ProviderAvailability>('available');
  const [profile, setProfile] = useState<LogisticsProviderProfile | null>(null);
  const [targetedOpportunity, setTargetedOpportunity] = useState<DeliveryRecord | null>(null);
  const [opportunities, setOpportunities] = useState<DeliveryRecord[]>([]);
  const [assignedDeliveries, setAssignedDeliveries] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const providerName = profile?.providerName || user?.fullName || 'SwiftHaul Express';

  const refreshData = useCallback(async (coverageArea?: string) => {
    try {
      setRefreshError(null);
      const [targeted, opps, assigned] = await Promise.all([
        deliveryService.getProviderTargetedOpportunity(providerId),
        deliveryService.getProviderOpportunities(coverageArea),
        deliveryService.getProviderAssignedDeliveries(providerId),
      ]);
      setTargetedOpportunity(targeted);
      setOpportunities(opps);
      setAssignedDeliveries(assigned);
    } catch (err) {
      console.error('Error refreshing provider data:', err);
      setRefreshError(err instanceof Error ? err.message : 'Failed to refresh dispatch opportunities.');
    }
  }, [providerId]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialProviderData() {
      try {
        const prof = await logisticsService.getProviderProfile(providerId);
        if (!isMounted) return;

        if (prof) {
          setProfile(prof);
          if (prof.availability) {
            setAvailability(prof.availability);
          }
        }

        await refreshData(prof?.coverageArea);
      } catch (err) {
        console.error('Failed to load provider profile:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialProviderData();

    return () => {
      isMounted = false;
    };
  }, [providerId, refreshData]);

  // Realtime subscription for incoming dispatch opportunities & assigned deliveries
  useEffect(() => {
    if (!providerId) return;

    const unsubscribe = deliveryService.subscribeToProviderDispatches(providerId, () => {
      refreshData(profile?.coverageArea);
    });

    return () => {
      unsubscribe();
    };
  }, [providerId, profile?.coverageArea, refreshData]);

  const handleAvailabilityChange = async (newStatus: ProviderAvailability) => {
    setAvailability(newStatus);
    await logisticsService.updateProviderAvailability(providerId, newStatus);

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
    await refreshData(profile?.coverageArea);
  };

  const handleAcceptJob = async (job: DeliveryRecord) => {
    const updated = await deliveryService.acceptDelivery(job.id, providerId, providerName);
    if (updated) {
      addToast({
        title: 'Dispatch Accepted!',
        description: `Delivery ${job.id} is now assigned to your fleet queue.`,
        type: 'success',
      });
      setSelectedJob(null);
      await refreshData(profile?.coverageArea);
      setActiveTab('assigned');
    } else {
      addToast({
        title: 'Opportunity No Longer Available',
        description: `Delivery ${job.id} has already been assigned to another provider or cancelled.`,
        type: 'error',
      });
      setSelectedJob(null);
      await refreshData(profile?.coverageArea);
    }
  };

  const handleDeclineJob = async (jobId: string) => {
    await deliveryService.declineOpportunity(jobId, providerId);
    addToast({
      title: 'Opportunity Declined',
      description: `OrderFlow has routed delivery ${jobId} to the next eligible provider candidate.`,
      type: 'info',
    });
    setSelectedJob(null);
    await refreshData(profile?.coverageArea);
  };

  const handleUpdateStatus = async (jobId: string, newStatus: DeliveryStatus) => {
    const updated = await deliveryService.updateDeliveryStatus(jobId, newStatus, user?.id);
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
      await refreshData(profile?.coverageArea);
    } else {
      addToast({
        title: 'Status Update Failed',
        description: `Unable to transition delivery ${jobId} to ${newStatus}. Please verify your permissions or try again.`,
        type: 'error',
      });
    }
  };

  const handleInitiateDeliveryCompletion = (job: DeliveryRecord) => {
    setPodModalJob(job);
    setPodPin('');
    setPodPhoto(undefined);
    setPodError(null);
  };

  const handlePodPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPodPhoto(reader.result);
        setPodError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmPodDelivery = async () => {
    if (!podModalJob) return;
    if (!podPin.trim()) {
      setPodError('Please enter the 4-digit verification code provided by the customer.');
      return;
    }
    if (podModalJob.requirePhotoProof && !podPhoto) {
      setPodError('Vendor has required photo proof of delivery. Please snap or upload a handover photo.');
      return;
    }

    setIsVerifyingPod(true);
    setPodError(null);

    try {
      const res = await deliveryService.completeDeliveryWithPod(
        podModalJob.id,
        podPin.trim(),
        podPhoto
      );

      if (res.success) {
        addToast({
          title: 'Delivery Confirmed & Verified',
          description: `Order ${podModalJob.trackingCode || podModalJob.id} marked delivered.${
            podModalJob.paymentMethod === 'cash_on_delivery' ? ' Cash on Delivery collected.' : ''
          }`,
          type: 'success',
        });
        setPodModalJob(null);
        setPodPin('');
        setPodPhoto(undefined);
        await refreshData(profile?.coverageArea);
      } else {
        setPodError(res.error || 'Failed to verify Proof of Delivery.');
      }
    } catch (err) {
      console.error('Error completing delivery with POD:', err);
      setPodError(err instanceof Error ? err.message : 'Failed to complete delivery.');
    } finally {
      setIsVerifyingPod(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="of-provider-dashboard">
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

      {/* Database/Network Refresh Error Alert Banner */}
      {refreshError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            color: '#DC2626',
            fontSize: 'var(--font-size-sm)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AlertCircle size={18} />
            <span>{refreshError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refreshData(profile?.coverageArea)} disabled={isLoading}>
            Retry
          </Button>
        </div>
      )}

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
                {targetedOpportunity.trackingCode || targetedOpportunity.id}
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

              {isLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
                  <Clock size={32} color="var(--color-brand-accent)" style={{ marginBottom: 'var(--space-2)', animation: 'spin 2s linear infinite' }} />
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Loading available delivery opportunities...
                  </p>
                </div>
              ) : opportunities.length === 0 ? (
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
                              {opp.trackingCode || opp.id}
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

              {isLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
                  <Clock size={32} color="var(--color-brand-accent)" style={{ marginBottom: 'var(--space-2)', animation: 'spin 2s linear infinite' }} />
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Loading active dispatches...
                  </p>
                </div>
              ) : assignedDeliveries.length === 0 ? (
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
                            {job.trackingCode || job.id}
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

                      {/* Payment & POD Requirements Badges */}
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: job.paymentMethod === 'cash_on_delivery' ? 'rgba(245, 158, 11, 0.12)' : 'var(--color-bg-surface)',
                            color: job.paymentMethod === 'cash_on_delivery' ? '#D97706' : 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border-subtle)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Banknote size={12} />
                          {job.paymentMethod === 'cash_on_delivery'
                            ? `COD: ₦${job.estimatedPrice.toLocaleString()}`
                            : job.paymentMethod === 'pay_at_pickup'
                            ? 'Pay at Pickup'
                            : 'Prepaid Online'}
                        </span>
                        {job.requirePhotoProof && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(59, 130, 246, 0.1)',
                              color: '#2563EB',
                              border: '1px solid rgba(59, 130, 246, 0.2)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Camera size={12} /> Photo Proof Required
                          </span>
                        )}
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
                            onClick={() => handleInitiateDeliveryCompletion(job)}
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
        title={`Delivery Details (${selectedJob?.trackingCode || selectedJob?.id})`}
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

      {/* Modal: Proof of Delivery (POD) Handover Verification */}
      <Modal
        isOpen={!!podModalJob}
        onClose={() => {
          if (!isVerifyingPod) {
            setPodModalJob(null);
            setPodPin('');
            setPodPhoto(undefined);
            setPodError(null);
          }
        }}
        title={`Proof of Delivery — ${podModalJob?.trackingCode || podModalJob?.id}`}
        maxWidth="md"
      >
        {podModalJob && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Delivery Info */}
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-brand-accent)', textTransform: 'uppercase' }}>
                  Handover Verification
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                  Vendor: <strong>{podModalJob.vendorName}</strong>
                </span>
              </div>
              <h4 style={{ margin: '0 0 2px 0', fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {podModalJob.productName}
              </h4>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Dropoff: {podModalJob.destination.address}, {podModalJob.destination.city} • Recipient: <strong>{podModalJob.recipient.name}</strong> ({podModalJob.recipient.phone})
              </p>
            </div>

            {/* Payment Collection Prompt */}
            {podModalJob.paymentMethod === 'cash_on_delivery' ? (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <Banknote size={24} color="#D97706" style={{ flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>
                    Cash on Delivery Collection Required
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Collect ₦{podModalJob.estimatedPrice.toLocaleString()} from customer in cash or instant transfer before handing over the item.
                  </p>
                </div>
              </div>
            ) : podModalJob.paymentMethod === 'pay_at_pickup' ? (
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <strong>Pay at Pickup:</strong> Delivery fare was settled with the vendor at dispatch. Do not collect from the recipient.
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <strong>Prepaid Online:</strong> Order paid digitally. No payment collection required from the recipient.
              </div>
            )}

            {/* 4-Digit Code Input */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
                4-Digit Recipient Handover Code <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                maxLength={4}
                placeholder="4-digit PIN (e.g. 4892)"
                value={podPin}
                onChange={(e) => {
                  setPodPin(e.target.value.replace(/\D/g, ''));
                  setPodError(null);
                }}
                style={{
                  width: '100%',
                  padding: '12px var(--space-4)',
                  fontSize: 'var(--font-size-xl)',
                  fontFamily: 'monospace',
                  letterSpacing: '6px',
                  textAlign: 'center',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  background: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                Ask the recipient for their 4-digit code (found on their OrderFlow tracking link / WhatsApp notification).
              </p>
            </div>

            {/* Photo Proof Upload */}
            <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Camera size={14} color="var(--color-brand-accent)" />
                  Handover Photo Proof {podModalJob.requirePhotoProof ? <span style={{ color: '#DC2626' }}>* (Required by Vendor)</span> : <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(Optional)</span>}
                </label>
                {podPhoto && (
                  <button
                    type="button"
                    onClick={() => setPodPhoto(undefined)}
                    style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: 0 }}
                  >
                    Remove Photo
                  </button>
                )}
              </div>

              {podPhoto ? (
                <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-default)', maxHeight: '180px' }}>
                  <img src={podPhoto} alt="Proof of delivery preview" style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-4)',
                    border: '2px dashed var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    background: 'var(--color-bg-subtle)',
                    textAlign: 'center',
                  }}
                >
                  <Upload size={20} color="var(--color-text-tertiary)" />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                    Click to capture handover photo or upload image
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handlePodPhotoUpload}
                  />
                </label>
              )}
            </div>

            {/* Error Message */}
            {podError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  color: '#DC2626',
                  fontSize: 'var(--font-size-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{podError}</span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-default)' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setPodModalJob(null);
                  setPodPin('');
                  setPodPhoto(undefined);
                  setPodError(null);
                }}
                disabled={isVerifyingPod}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmPodDelivery}
                isLoading={isVerifyingPod}
                leftIcon={<ShieldCheck size={16} />}
              >
                Verify & Complete Handover
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

