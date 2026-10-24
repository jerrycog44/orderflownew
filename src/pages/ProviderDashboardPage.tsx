import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  CheckCircle2,
  PackageCheck,
  Phone,
  XCircle,
  AlertCircle,
  Camera,
  ShieldCheck,
  Banknote,
  Upload,
  RotateCw,
  User as UserIcon,
  Compass,
  Repeat,
  LogOut,
  Package,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { deliveryService } from '../services/deliveryService';
import { logisticsService } from '../services/logisticsService';
import { useToast } from '../components/ui/Toast';
import {
  MobileHeader,
  StatusFilterPills,
  BottomSheet,
} from '../components/mobile';
import type { FilterPillItem } from '../components/mobile';
import type { LogisticsProviderProfile, DeliveryRecord, DeliveryStatus, ProviderAvailability } from '../types';
import './ProviderDashboardPage.css';

export const ProviderDashboardPage: React.FC = () => {
  const { user, signOut, setRole } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const providerId = user?.id || 'prov_swifthaul';

  // Availability State
  const [availability, setAvailability] = useState<ProviderAvailability>('available');
  const [profile, setProfile] = useState<LogisticsProviderProfile | null>(null);

  // Deliveries State
  const [targetedOpportunity, setTargetedOpportunity] = useState<DeliveryRecord | null>(null);
  const [opportunities, setOpportunities] = useState<DeliveryRecord[]>([]);
  const [assignedDeliveries, setAssignedDeliveries] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Active Tab: 'opportunities' | 'active' | 'completed'
  const [activeTab, setActiveTab] = useState<string>('opportunities');

  // Job Details Drawer state
  const [selectedJob, setSelectedJob] = useState<DeliveryRecord | null>(null);

  // Proof of Delivery (POD) modal state
  const [podModalJob, setPodModalJob] = useState<DeliveryRecord | null>(null);
  const [podPin, setPodPin] = useState('');
  const [podPhoto, setPodPhoto] = useState<string | undefined>(undefined);
  const [podError, setPodError] = useState<string | null>(null);
  const [isVerifyingPod, setIsVerifyingPod] = useState(false);

  // Profile Drawer state
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [editProviderName, setEditProviderName] = useState('');
  const [editCoverageArea, setEditCoverageArea] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const providerName = profile?.providerName || user?.fullName || 'SwiftHaul Express';

  // Initial and reactive data fetch
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setRefreshError(null);
        const prof = await logisticsService.getProviderProfile(providerId);

        if (!isMounted) return;

        if (prof) {
          setProfile(prof);
          setEditProviderName(prof.providerName || '');
          setEditCoverageArea(prof.coverageArea || '');
          if (prof.availability) {
            setAvailability(prof.availability);
          }
        }

        const [targeted, opps, assigned] = await Promise.all([
          deliveryService.getProviderTargetedOpportunity(providerId),
          deliveryService.getProviderOpportunities(prof?.coverageArea, providerId),
          deliveryService.getProviderAssignedDeliveries(providerId),
        ]);

        if (isMounted) {
          setTargetedOpportunity(targeted);
          setOpportunities(opps);
          setAssignedDeliveries(assigned);
        }
      } catch (err) {
        console.error('Error refreshing provider data:', err);
        if (isMounted) {
          setRefreshError(err instanceof Error ? err.message : 'Failed to refresh dispatch opportunities.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [providerId, refreshTrigger]);

  // Realtime subscription for incoming dispatch opportunities & assigned deliveries
  useEffect(() => {
    if (!providerId) return;

    const unsubscribe = deliveryService.subscribeToProviderDispatches(providerId, () => {
      setRefreshTrigger((prev) => prev + 1);
    });

    return () => {
      unsubscribe();
    };
  }, [providerId]);

  // Listen for workspace profile updates from global events
  useEffect(() => {
    if (!user?.id) return;
    const handleProfileUpdated = () => {
      setRefreshTrigger((prev) => prev + 1);
    };
    window.addEventListener('of:profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('of:profile-updated', handleProfileUpdated);
  }, [user?.id]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleAvailabilityChange = async (newStatus: ProviderAvailability) => {
    setAvailability(newStatus);
    await logisticsService.updateProviderAvailability(providerId, newStatus);

    const statusLabels: Record<ProviderAvailability, string> = {
      available: 'Online & Available for Dispatches',
      busy: 'Busy (Active Dispatch Queue)',
      unavailable: 'Offline / Unavailable',
    };

    addToast({
      title: 'Availability Status Updated',
      description: `Your status is now ${statusLabels[newStatus]}.`,
      type: newStatus === 'available' ? 'success' : newStatus === 'busy' ? 'warning' : 'info',
    });

    setRefreshTrigger((prev) => prev + 1);
  };

  const handleAcceptJob = async (job: DeliveryRecord) => {
    const updated = await deliveryService.acceptDelivery(job.id, providerId, providerName);
    if (updated) {
      addToast({
        title: 'Dispatch Accepted!',
        description: `Order ${job.trackingCode || job.id} assigned to your active queue.`,
        type: 'success',
      });
      setSelectedJob(null);
      setRefreshTrigger((prev) => prev + 1);
      setActiveTab('active');
    } else {
      addToast({
        title: 'Opportunity Unavailable',
        description: `Order ${job.id} was already assigned to another provider or cancelled.`,
        type: 'error',
      });
      setSelectedJob(null);
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  const handleDeclineJob = async (jobId: string) => {
    await deliveryService.declineOpportunity(jobId, providerId);
    addToast({
      title: 'Opportunity Declined',
      description: `Delivery ${jobId} routed to the next available provider candidate.`,
      type: 'info',
    });
    setSelectedJob(null);
    setRefreshTrigger((prev) => prev + 1);
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
        description: `Delivery updated to ${statusLabels[newStatus] || newStatus}.`,
        type: 'info',
      });
      setRefreshTrigger((prev) => prev + 1);
    } else {
      addToast({
        title: 'Status Update Failed',
        description: `Unable to transition delivery ${jobId} to ${newStatus}.`,
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
      setPodError('Vendor has required photo proof of delivery. Please capture or upload a handover photo.');
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
        setRefreshTrigger((prev) => prev + 1);
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsSavingProfile(true);
    try {
      await logisticsService.updateProviderProfile(user.id, {
        providerName: editProviderName.trim(),
        coverageArea: editCoverageArea.trim(),
      });

      addToast({
        title: 'Profile Updated',
        description: 'Fleet details saved successfully.',
        type: 'success',
      });

      setProfileSheetOpen(false);
      setRefreshTrigger((prev) => prev + 1);
      window.dispatchEvent(new CustomEvent('of:profile-updated'));
    } catch (err) {
      console.error('Failed to update provider profile:', err);
      addToast({
        title: 'Update Failed',
        description: 'Unable to save profile changes.',
        type: 'error',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRoleSwitch = async () => {
    setProfileSheetOpen(false);
    const { error } = await setRole('vendor');
    if (!error) {
      addToast({
        title: 'Switched Workspace',
        description: 'Now operating in Merchant / Vendor workspace.',
        type: 'info',
      });
      navigate('/vendor/dashboard');
    }
  };

  const handleSignOut = () => {
    setProfileSheetOpen(false);
    signOut();
    navigate('/login');
  };

  // Real data metrics computation
  const activeAssignedDeliveries = assignedDeliveries.filter((d) => d.status !== 'delivered');
  const completedDeliveries = assignedDeliveries.filter((d) => d.status === 'delivered');
  // Earnings are strictly computed from actual completed delivery records
  const totalCompletedEarnings = completedDeliveries.reduce(
    (sum, d) => sum + (d.estimatedPrice || 0),
    0
  );

  // Tab filter items
  const filterPills: FilterPillItem[] = [
    { key: 'opportunities', label: 'Available Offers', count: opportunities.length },
    { key: 'active', label: 'Active Jobs', count: activeAssignedDeliveries.length },
    { key: 'completed', label: 'Delivered', count: completedDeliveries.length },
  ];

  return (
    <div className="of-rider-page" data-testid="rider-dashboard-page">
      {/* 1. Mobile Safe Header */}
      <MobileHeader
        title={providerName}
        subtitle={profile?.coverageArea || 'Last-Mile Fleet'}
        workspaceBadge="Courier"
        rightAction={
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className={`of-m-icon-btn ${isRefreshing ? 'is-spinning' : ''}`}
              onClick={handleRefresh}
              aria-label="Refresh courier feed"
              title="Refresh feed"
              data-testid="rider-refresh-btn"
            >
              <RotateCw size={20} />
            </button>
            <button
              type="button"
              className="of-m-icon-btn"
              onClick={() => setProfileSheetOpen(true)}
              aria-label="View Fleet Profile"
              title="Fleet Profile"
              data-testid="rider-profile-btn"
            >
              <UserIcon size={20} />
            </button>
          </div>
        }
      />

      <div className="of-rider-container">
        {/* 2. Availability Segmented Switcher (48px Touch Minimum) */}
        <section aria-label="Rider Availability">
          <div className="of-rider-availability-wrapper" data-testid="rider-availability-toggle">
            <button
              type="button"
              onClick={() => handleAvailabilityChange('available')}
              className={`of-rider-avail-btn is-online ${availability === 'available' ? 'active' : ''}`}
              data-testid="avail-online-btn"
            >
              <span className="of-rider-avail-dot" aria-hidden="true" />
              <span>Online</span>
            </button>

            <button
              type="button"
              onClick={() => handleAvailabilityChange('busy')}
              className={`of-rider-avail-btn is-busy ${availability === 'busy' ? 'active' : ''}`}
              data-testid="avail-busy-btn"
            >
              <span className="of-rider-avail-dot" aria-hidden="true" />
              <span>Busy</span>
            </button>

            <button
              type="button"
              onClick={() => handleAvailabilityChange('unavailable')}
              className={`of-rider-avail-btn is-offline ${availability === 'unavailable' ? 'active' : ''}`}
              data-testid="avail-offline-btn"
            >
              <span className="of-rider-avail-dot" aria-hidden="true" />
              <span>Offline</span>
            </button>
          </div>
        </section>

        {/* 3. Offline Notice Banner */}
        {availability === 'unavailable' && (
          <div className="of-rider-offline-banner" role="status" data-testid="rider-offline-banner">
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>You are currently <strong>Offline</strong>. Switch to <strong>Online</strong> to receive live dispatch opportunities.</span>
          </div>
        )}

        {/* 4. High-Priority Targeted Opportunity Card */}
        {targetedOpportunity && availability !== 'unavailable' && (
          <section className="of-rider-targeted-card" data-testid="targeted-opportunity-card">
            <div className="of-targeted-top">
              <span className="of-targeted-badge">
                <span className="of-targeted-live-dot" />
                NEW TARGETED DISPATCH
              </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', color: 'var(--m-color-brand-accent)' }}>
                {targetedOpportunity.trackingCode || targetedOpportunity.id}
              </span>
            </div>

            <div>
              <h3 style={{ fontSize: 'var(--m-text-base)', fontWeight: 700, color: 'var(--m-color-text-primary)', margin: '0 0 2px 0' }}>
                {targetedOpportunity.productName}
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--m-text-xs)', color: 'var(--m-color-text-secondary)' }}>
                Vendor: <strong>{targetedOpportunity.vendorName}</strong> • {targetedOpportunity.package.weightKg} kg ({targetedOpportunity.package.packageType})
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--m-text-xs)', background: 'var(--m-color-bg-surface)', padding: '10px', borderRadius: 'var(--m-radius-md)' }}>
              <div>
                <strong style={{ color: 'var(--m-color-brand-accent)' }}>PICKUP: </strong>
                <span>{targetedOpportunity.pickup.address} ({targetedOpportunity.pickup.city})</span>
              </div>
              <div>
                <strong style={{ color: 'var(--m-status-success-dot)' }}>DROPOFF: </strong>
                <span>{targetedOpportunity.destination.address} ({targetedOpportunity.destination.city})</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--m-text-xs)', color: 'var(--m-color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Payout Fare
              </span>
              <span style={{ fontSize: 'var(--m-text-xl)', fontWeight: 800, color: 'var(--m-status-success-dot)' }}>
                ₦{targetedOpportunity.estimatedPrice.toLocaleString()}
              </span>
            </div>

            <div className="of-targeted-actions">
              <button
                type="button"
                className="of-targeted-btn decline"
                onClick={() => handleDeclineJob(targetedOpportunity.id)}
                data-testid="targeted-decline-btn"
              >
                <XCircle size={16} />
                <span>Decline</span>
              </button>
              <button
                type="button"
                className="of-targeted-btn accept"
                onClick={() => handleAcceptJob(targetedOpportunity)}
                data-testid="targeted-accept-btn"
              >
                <CheckCircle2 size={16} />
                <span>Accept Job</span>
              </button>
            </div>
          </section>
        )}

        {/* 5. Error State Banner */}
        {refreshError && (
          <div className="of-merchant-error-banner" role="alert" data-testid="rider-error-banner">
            <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div className="of-merchant-error-content">
              <p className="of-merchant-error-title">Unable to sync opportunities</p>
              <p className="of-merchant-error-desc">{refreshError}</p>
              <button
                type="button"
                className="of-merchant-cta-btn"
                style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px' }}
                onClick={handleRefresh}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* 6. Operational Glanceable Metrics */}
        <section className="of-rider-metrics-grid" aria-label="Courier Operational Metrics">
          <div className="of-m-metric-card" data-testid="metric-open-offers">
            <div className="of-m-metric-top">
              <span className="of-m-metric-label">Open Offers</span>
              <div className="of-m-metric-icon info">
                <Compass size={16} />
              </div>
            </div>
            <p className="of-m-metric-value">{opportunities.length}</p>
          </div>

          <div className="of-m-metric-card" data-testid="metric-active-jobs">
            <div className="of-m-metric-top">
              <span className="of-m-metric-label">Active Jobs</span>
              <div className="of-m-metric-icon warning">
                <Truck size={16} />
              </div>
            </div>
            <p className="of-m-metric-value">{activeAssignedDeliveries.length}</p>
          </div>

          <div className="of-m-metric-card" data-testid="metric-completed-jobs">
            <div className="of-m-metric-top">
              <span className="of-m-metric-label">Delivered</span>
              <div className="of-m-metric-icon success">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <p className="of-m-metric-value">{completedDeliveries.length}</p>
          </div>

          <div className="of-m-metric-card" data-testid="metric-real-earnings">
            <div className="of-m-metric-top">
              <span className="of-m-metric-label">Settled Payout</span>
              <div className="of-m-metric-icon success">
                <Banknote size={16} />
              </div>
            </div>
            <p className="of-m-metric-value" style={{ fontSize: '1.125rem' }}>
              ₦{totalCompletedEarnings.toLocaleString()}
            </p>
          </div>
        </section>

        {/* 7. Filter Carousel */}
        <StatusFilterPills
          items={filterPills}
          selectedKey={activeTab}
          onSelect={setActiveTab}
        />

        {/* 8. Deliveries Feed */}
        <section aria-label="Courier Jobs Feed">
          {isLoading ? (
            <div data-testid="rider-skeleton-loader">
              {[1, 2, 3].map((n) => (
                <div key={n} className="of-m-skeleton-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <div className="of-m-skeleton-line" style={{ width: '90px', height: '22px' }} />
                    <div className="of-m-skeleton-line" style={{ width: '80px', height: '22px' }} />
                  </div>
                  <div className="of-m-skeleton-line" style={{ width: '100%', height: '40px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', paddingTop: '8px' }}>
                    <div className="of-m-skeleton-line" style={{ width: '120px', height: '24px' }} />
                    <div className="of-m-skeleton-line" style={{ width: '50px', height: '24px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === 'opportunities' ? (
            // TAB 1: Available Opportunities
            opportunities.length === 0 ? (
              <div className="of-merchant-empty-state" data-testid="rider-empty-opportunities">
                <div className="of-m-empty-icon-box">
                  <Compass size={30} />
                </div>
                <h4 className="of-m-empty-title">No open delivery requests</h4>
                <p className="of-m-empty-desc">
                  New orders in {profile?.coverageArea || 'your service territory'} will appear here instantly via live dispatch.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="rider-opportunities-list">
                {opportunities.map((opp) => (
                  <article key={opp.id} className="of-rider-job-item" data-testid={`opportunity-item-${opp.id}`}>
                    <div className="of-rider-job-header">
                      <div>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', color: 'var(--m-color-brand-accent)' }}>
                          {opp.trackingCode || opp.id}
                        </span>
                        <h3 style={{ fontSize: 'var(--m-text-base)', fontWeight: 700, color: 'var(--m-color-text-primary)', margin: '2px 0 0 0' }}>
                          {opp.productName}
                        </h3>
                        <p style={{ margin: 0, fontSize: 'var(--m-text-xs)', color: 'var(--m-color-text-muted)' }}>
                          Vendor: {opp.vendorName} • {opp.package.weightKg} kg ({opp.package.packageType})
                        </p>
                      </div>

                      <span className="of-rider-payout-highlight">
                        ₦{opp.estimatedPrice.toLocaleString()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--m-text-xs)', background: 'var(--m-color-bg-subtle)', padding: '8px 10px', borderRadius: 'var(--m-radius-sm)' }}>
                      <div>
                        <strong style={{ color: 'var(--m-color-brand-accent)' }}>Pickup: </strong>
                        <span>{opp.pickup.address} ({opp.pickup.city})</span>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--m-status-success-dot)' }}>Dropoff: </strong>
                        <span>{opp.destination.address} ({opp.destination.city})</span>
                      </div>
                    </div>

                    <div className="of-rider-action-row">
                      <button
                        type="button"
                        className="of-targeted-btn accept"
                        style={{ minHeight: '40px', padding: '0 16px' }}
                        onClick={() => setSelectedJob(opp)}
                        data-testid={`view-accept-btn-${opp.id}`}
                      >
                        <span>View & Accept</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : activeTab === 'active' ? (
            // TAB 2: Active Assigned Deliveries
            activeAssignedDeliveries.length === 0 ? (
              <div className="of-merchant-empty-state" data-testid="rider-empty-active">
                <div className="of-m-empty-icon-box">
                  <Truck size={30} />
                </div>
                <h4 className="of-m-empty-title">No active dispatches</h4>
                <p className="of-m-empty-desc">
                  Accept an open request from the Available Offers tab to start your delivery run.
                </p>
                <button
                  type="button"
                  className="of-merchant-cta-btn"
                  onClick={() => setActiveTab('opportunities')}
                  data-testid="rider-view-offers-cta"
                >
                  View Open Offers
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="rider-active-list">
                {activeAssignedDeliveries.map((job) => (
                  <article key={job.id} className="of-rider-job-item" data-testid={`active-job-${job.id}`}>
                    <div className="of-rider-job-header">
                      <div>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', color: 'var(--m-color-brand-accent)' }}>
                          {job.trackingCode || job.id}
                        </span>
                        <h3 style={{ fontSize: 'var(--m-text-base)', fontWeight: 700, color: 'var(--m-color-text-primary)', margin: '2px 0 0 0' }}>
                          {job.productName}
                        </h3>
                      </div>

                      <span
                        className={`of-m-status-pill ${
                          job.status === 'in_transit' ? 'of-m-status-info' : 'of-m-status-warning'
                        }`}
                      >
                        <span className="of-m-status-dot" />
                        {job.status === 'in_transit' ? 'In Transit' : 'Matched / Pickup'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: 'var(--m-text-xs)', background: 'var(--m-color-bg-subtle)', padding: '10px', borderRadius: 'var(--m-radius-sm)' }}>
                      <div>
                        <strong>Pickup: </strong>
                        <span>{job.pickup.address} ({job.pickup.city})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <strong>Recipient: </strong>
                          <span>{job.recipient.name}</span>
                        </div>
                        {job.recipient.phone && (
                          <a
                            href={`tel:${job.recipient.phone}`}
                            className="of-rider-phone-link"
                            aria-label={`Call recipient ${job.recipient.name}`}
                          >
                            <Phone size={12} />
                            <span>{job.recipient.phone}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Payment & Proof Chips */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 'var(--m-radius-sm)',
                          background: job.paymentMethod === 'cash_on_delivery' ? 'var(--m-status-warning-bg)' : 'var(--m-color-bg-surface)',
                          color: job.paymentMethod === 'cash_on_delivery' ? 'var(--m-status-warning-text)' : 'var(--m-color-text-secondary)',
                          border: '1px solid var(--m-color-border-subtle)',
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
                            borderRadius: 'var(--m-radius-sm)',
                            background: 'var(--m-status-info-bg)',
                            color: 'var(--m-status-info-text)',
                            border: '1px solid var(--m-status-info-border)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Camera size={12} /> Photo Proof Required
                        </span>
                      )}
                    </div>

                    {/* Operational Action Buttons */}
                    <div className="of-rider-action-row">
                      {job.status !== 'in_transit' && (
                        <button
                          type="button"
                          className="of-targeted-btn decline"
                          style={{ minHeight: '40px', padding: '0 14px' }}
                          onClick={() => handleUpdateStatus(job.id, 'in_transit')}
                          data-testid={`mark-in-transit-btn-${job.id}`}
                        >
                          <Truck size={14} />
                          <span>Start Trip</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="of-targeted-btn accept"
                        style={{ minHeight: '40px', padding: '0 16px' }}
                        onClick={() => handleInitiateDeliveryCompletion(job)}
                        data-testid={`complete-delivery-btn-${job.id}`}
                      >
                        <CheckCircle2 size={14} />
                        <span>Confirm Handover (POD)</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : (
            // TAB 3: Completed Deliveries
            completedDeliveries.length === 0 ? (
              <div className="of-merchant-empty-state" data-testid="rider-empty-completed">
                <div className="of-m-empty-icon-box">
                  <PackageCheck size={30} />
                </div>
                <h4 className="of-m-empty-title">No completed deliveries yet</h4>
                <p className="of-m-empty-desc">
                  Deliveries finished with verified customer PIN will appear here with settled earnings.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="rider-completed-list">
                {completedDeliveries.map((job) => (
                  <article key={job.id} className="of-rider-job-item" data-testid={`completed-job-${job.id}`}>
                    <div className="of-rider-job-header">
                      <div>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', color: 'var(--m-color-brand-accent)' }}>
                          {job.trackingCode || job.id}
                        </span>
                        <h3 style={{ fontSize: 'var(--m-text-base)', fontWeight: 700, color: 'var(--m-color-text-primary)', margin: '2px 0 0 0' }}>
                          {job.productName}
                        </h3>
                        <p style={{ margin: 0, fontSize: 'var(--m-text-xs)', color: 'var(--m-color-text-muted)' }}>
                          Delivered to {job.destination.city}
                        </p>
                      </div>

                      <span className="of-rider-payout-highlight">
                        +₦{job.estimatedPrice.toLocaleString()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--m-text-xs)', color: 'var(--m-status-success-text)', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={14} /> Handover Verified
                      </span>
                      {job.podCompletedAt && (
                        <span style={{ color: 'var(--m-color-text-muted)', fontWeight: 400 }}>
                          {new Date(job.podCompletedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )
          )}
        </section>
      </div>

      {/* 9. BottomSheet: Job Details & Acceptance */}
      <BottomSheet
        isOpen={Boolean(selectedJob)}
        onClose={() => setSelectedJob(null)}
        title={`Dispatch Details — ${selectedJob?.trackingCode || selectedJob?.id}`}
        description="Review package parameters and delivery locations"
      >
        {selectedJob && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }} data-testid="job-details-sheet">
            <div style={{ padding: '12px', background: 'var(--m-color-bg-subtle)', borderRadius: 'var(--m-radius-md)' }}>
              <h4 style={{ margin: '0 0 2px 0', fontSize: 'var(--m-text-base)', fontWeight: 700, color: 'var(--m-color-text-primary)' }}>
                {selectedJob.productName}
              </h4>
              <p style={{ margin: 0, fontSize: 'var(--m-text-xs)', color: 'var(--m-color-text-secondary)' }}>
                Vendor: <strong>{selectedJob.vendorName}</strong> • {selectedJob.package.weightKg} kg ({selectedJob.package.packageType})
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--m-text-sm)' }}>
              <div style={{ border: '1px solid var(--m-color-border-default)', padding: '10px', borderRadius: 'var(--m-radius-md)' }}>
                <strong style={{ color: 'var(--m-color-brand-accent)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Pickup Address
                </strong>
                <p style={{ margin: '2px 0 0 0', fontWeight: 600 }}>{selectedJob.pickup.address}</p>
                <p style={{ margin: '1px 0 0 0', fontSize: 'var(--m-text-xs)', color: 'var(--m-color-text-muted)' }}>{selectedJob.pickup.city}</p>
              </div>

              <div style={{ border: '1px solid var(--m-color-border-default)', padding: '10px', borderRadius: 'var(--m-radius-md)' }}>
                <strong style={{ color: 'var(--m-status-success-dot)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Dropoff Address
                </strong>
                <p style={{ margin: '2px 0 0 0', fontWeight: 600 }}>{selectedJob.destination.address}</p>
                <p style={{ margin: '1px 0 0 0', fontSize: 'var(--m-text-xs)', color: 'var(--m-color-text-muted)' }}>{selectedJob.destination.city}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: 'var(--m-text-xs)', color: 'var(--m-color-text-secondary)' }}>
                  Recipient: {selectedJob.recipient.name} ({selectedJob.recipient.phone})
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--m-color-border-subtle)' }}>
              <span style={{ fontSize: 'var(--m-text-xs)', color: 'var(--m-color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Fleet Payout
              </span>
              <span style={{ fontSize: 'var(--m-text-xl)', fontWeight: 800, color: 'var(--m-status-success-dot)' }}>
                ₦{selectedJob.estimatedPrice.toLocaleString()}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                className="of-targeted-btn decline"
                style={{ flex: 1 }}
                onClick={() => setSelectedJob(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="of-targeted-btn accept"
                style={{ flex: 2 }}
                onClick={() => handleAcceptJob(selectedJob)}
                data-testid="sheet-accept-dispatch-btn"
              >
                Accept Dispatch
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* 10. BottomSheet: Proof of Delivery (POD) Handover Verification */}
      <BottomSheet
        isOpen={Boolean(podModalJob)}
        onClose={() => {
          if (!isVerifyingPod) {
            setPodModalJob(null);
            setPodPin('');
            setPodPhoto(undefined);
            setPodError(null);
          }
        }}
        title={`Handover Verification — ${podModalJob?.trackingCode || podModalJob?.id}`}
        description="Verify recipient PIN code and collect fare before handover"
      >
        {podModalJob && (
          <div className="of-rider-pod-sheet" data-testid="pod-handover-sheet">
            {/* Cash on Delivery prompt if applicable */}
            {podModalJob.paymentMethod === 'cash_on_delivery' && (
              <div className="of-rider-cod-alert">
                <Banknote size={24} style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>
                    Cash on Delivery Collection Required
                  </strong>
                  <span style={{ fontSize: 'var(--m-text-xs)', fontWeight: 600 }}>
                    Collect ₦{podModalJob.estimatedPrice.toLocaleString()} from customer in cash or instant transfer before handing over.
                  </span>
                </div>
              </div>
            )}

            {/* 4-digit PIN input */}
            <div>
              <label htmlFor="pod-pin-input" style={{ display: 'block', fontSize: 'var(--m-text-xs)', fontWeight: 700, color: 'var(--m-color-text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                4-Digit Recipient Handover Code <span style={{ color: 'var(--m-status-error-dot)' }}>*</span>
              </label>
              <input
                id="pod-pin-input"
                type="text"
                maxLength={4}
                placeholder="4-digit PIN (e.g. 4892)"
                value={podPin}
                onChange={(e) => {
                  setPodPin(e.target.value.replace(/\D/g, ''));
                  setPodError(null);
                }}
                className="of-pod-pin-input"
                data-testid="input-pod-pin"
              />
              <p style={{ margin: '4px 0 0 0', fontSize: '0.6875rem', color: 'var(--m-color-text-muted)' }}>
                Ask the recipient for the 4-digit code shown on their tracking screen.
              </p>
            </div>

            {/* Camera photo proof upload */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: 'var(--m-text-xs)', fontWeight: 700, color: 'var(--m-color-text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Camera size={14} color="var(--m-color-brand-accent)" />
                  Handover Photo Proof {podModalJob.requirePhotoProof ? <span style={{ color: 'var(--m-status-error-dot)' }}>* (Required)</span> : <span style={{ color: 'var(--m-color-text-muted)', fontWeight: 400 }}>(Optional)</span>}
                </span>
                {podPhoto && (
                  <button
                    type="button"
                    onClick={() => setPodPhoto(undefined)}
                    style={{ background: 'none', border: 'none', color: 'var(--m-status-error-dot)', fontSize: 'var(--m-text-xs)', cursor: 'pointer', padding: 0 }}
                  >
                    Remove
                  </button>
                )}
              </div>

              {podPhoto ? (
                <div className="of-pod-photo-preview">
                  <img src={podPhoto} alt="Handover proof" className="of-pod-photo-img" />
                </div>
              ) : (
                <label className="of-pod-photo-zone">
                  <Upload size={22} color="var(--m-color-text-muted)" />
                  <span style={{ fontSize: 'var(--m-text-xs)', color: 'var(--m-color-text-secondary)', fontWeight: 500 }}>
                    Tap to snap handover photo or upload file
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handlePodPhotoUpload}
                    data-testid="input-pod-photo"
                  />
                </label>
              )}
            </div>

            {/* Error Message */}
            {podError && (
              <div className="of-merchant-error-banner" style={{ padding: '10px' }} data-testid="pod-error-message">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--m-text-xs)' }}>{podError}</span>
              </div>
            )}

            <button
              type="button"
              className="of-targeted-btn accept"
              style={{ width: '100%', minHeight: '48px', marginTop: '6px' }}
              onClick={handleConfirmPodDelivery}
              disabled={isVerifyingPod}
              data-testid="pod-verify-submit-btn"
            >
              <ShieldCheck size={18} />
              <span>{isVerifyingPod ? 'Verifying...' : 'Verify & Complete Delivery'}</span>
            </button>
          </div>
        )}
      </BottomSheet>

      {/* 11. BottomSheet: Provider Service Profile */}
      <BottomSheet
        isOpen={profileSheetOpen}
        onClose={() => setProfileSheetOpen(false)}
        title="Fleet & Logistics Profile"
        description="Manage your courier service credentials and operational parameters"
      >
        <div className="of-merchant-profile-sheet" data-testid="rider-profile-sheet">
          <div className="of-m-profile-hero">
            <div className="of-m-profile-avatar" style={{ backgroundColor: 'var(--m-status-info-dot)' }}>
              <Package size={24} />
            </div>
            <div className="of-m-profile-info">
              <p className="of-m-profile-name">{providerName}</p>
              <p className="of-m-profile-email">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="of-m-profile-form">
            <div className="of-m-form-group">
              <label htmlFor="provider-company-name" className="of-m-form-label">
                Fleet / Company Name
              </label>
              <input
                id="provider-company-name"
                type="text"
                className="of-m-form-input"
                value={editProviderName}
                onChange={(e) => setEditProviderName(e.target.value)}
                placeholder="e.g. SwiftHaul Express"
                required
                data-testid="input-fleet-name"
              />
            </div>

            <div className="of-m-form-group">
              <label htmlFor="provider-coverage-area" className="of-m-form-label">
                Primary Territory / Coverage
              </label>
              <input
                id="provider-coverage-area"
                type="text"
                className="of-m-form-input"
                value={editCoverageArea}
                onChange={(e) => setEditCoverageArea(e.target.value)}
                placeholder="e.g. Ibadan (Bodija, Ring Road), Lagos"
                required
                data-testid="input-coverage-area"
              />
            </div>

            <button
              type="submit"
              className="of-merchant-cta-btn"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={isSavingProfile}
              data-testid="rider-save-profile-btn"
            >
              {isSavingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <div className="of-m-profile-actions">
            <button
              type="button"
              className="of-m-action-btn-row"
              onClick={handleRoleSwitch}
              data-testid="rider-switch-role-btn"
            >
              <Repeat size={18} />
              <span>Switch to Merchant / Vendor View</span>
            </button>

            <button
              type="button"
              className="of-m-action-btn-row is-danger"
              onClick={handleSignOut}
              data-testid="rider-sign-out-btn"
            >
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
