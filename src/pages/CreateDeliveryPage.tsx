import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Zap, MapPin, Truck, CheckCircle2 } from 'lucide-react';
import type { PackageDetails, LocationPoint, LogisticsProvider } from '../types';
import { StepIndicator } from '../components/delivery/StepIndicator';
import { PackageStep } from '../components/delivery/PackageStep';
import { LocationStep } from '../components/delivery/LocationStep';
import { ReviewStep } from '../components/delivery/ReviewStep';
import { ProviderSelectionStep } from '../components/delivery/ProviderSelectionStep';
import { ConfirmationStep } from '../components/delivery/ConfirmationStep';
import { Button } from '../components/ui/Button';
import './CreateDeliveryPage.css';

export const CreateDeliveryPage: React.FC = () => {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [showManualSelection, setShowManualSelection] = useState(false);

  // Form State across wizard steps
  const [packageData, setPackageData] = useState<PackageDetails>({
    productName: '',
    itemCategory: 'Fashion & Apparel',
    packageType: 'box',
    quantity: 1,
    weightKg: 1.5,
    dimensionsCm: { length: 30, width: 20, height: 12 },
    fragile: false,
    notes: '',
  });

  const [pickup, setPickup] = useState<LocationPoint>({
    address: 'Plot 12 Commercial Avenue, Bodija',
    city: 'Ibadan',
  });

  const [destination, setDestination] = useState<LocationPoint>({
    address: 'No 45 Ring Road, Challenge',
    city: 'Ibadan',
  });

  const [recipient, setRecipient] = useState({
    name: 'Chioma Okeke',
    phone: '08129876543',
  });

  const [deliveryNote, setDeliveryNote] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<LogisticsProvider | null>(null);

  const handlePackageNext = (data: PackageDetails) => {
    setPackageData(data);
    setCurrentStep(2);
  };

  const handleLocationNext = (data: {
    pickup: LocationPoint;
    destination: LocationPoint;
    recipient: { name: string; phone: string };
    deliveryNote?: string;
  }) => {
    setPickup(data.pickup);
    setDestination(data.destination);
    setRecipient(data.recipient);
    if (data.deliveryNote !== undefined) setDeliveryNote(data.deliveryNote);
    setCurrentStep(3);
  };

  const handleReviewConfirm = () => {
    setCurrentStep(4);
  };

  return (
    <div className="of-create-delivery-container">
      <div className="of-create-delivery-header">
        <button
          type="button"
          className="of-create-delivery-back-link"
          onClick={() => navigate('/vendor/dashboard')}
        >
          <ArrowLeft size={16} />
          Back to Vendor Dashboard
        </button>

        <h1 className="of-create-delivery-title">Create New Delivery</h1>
        <p className="of-create-delivery-subtitle">
          OrderFlow Smart Dispatch automatically routes your shipment to top verified couriers.
        </p>
      </div>

      {/* Progress Step Bar */}
      <StepIndicator currentStep={currentStep} onStepClick={(s) => setCurrentStep(s)} />

      {/* Step Content Render */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        {currentStep === 1 && (
          <PackageStep initialData={packageData} onNext={handlePackageNext} />
        )}

        {currentStep === 2 && (
          <LocationStep
            initialPickup={pickup}
            initialDestination={destination}
            initialRecipient={recipient}
            initialDeliveryNote={deliveryNote}
            onBack={() => setCurrentStep(1)}
            onNext={handleLocationNext}
          />
        )}

        {currentStep === 3 && (
          <ReviewStep
            packageData={packageData}
            pickup={pickup}
            destination={destination}
            recipient={recipient}
            deliveryNote={deliveryNote}
            onEditPackage={() => setCurrentStep(1)}
            onEditLocations={() => setCurrentStep(2)}
            onBack={() => setCurrentStep(2)}
            onConfirmReview={handleReviewConfirm}
          />
        )}

        {currentStep === 4 && (
          <div>
            {!showManualSelection ? (
              /* DEFAULT: ORDERFLOW SMART DISPATCH */
              <div
                style={{
                  maxWidth: '680px',
                  margin: '0 auto',
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-8) var(--space-6)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--color-brand-accent-light)',
                      color: 'var(--color-brand-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto var(--space-3) auto',
                    }}
                  >
                    <Zap size={30} />
                  </div>
                  <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 var(--space-1) 0' }}>
                    OrderFlow Smart Dispatch
                  </h2>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                    OrderFlow will evaluate and route your shipment to the best available logistics provider.
                  </p>
                </div>

                {/* Dispatch Matching Criteria Box */}
                <div
                  style={{
                    background: 'var(--color-bg-subtle)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-5)',
                    marginBottom: 'var(--space-6)',
                  }}
                >
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-brand-accent)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={16} /> Automated Matching Criteria
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                      <CheckCircle2 size={16} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong>Live Provider Availability</strong>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Targets active & online fleets only.</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                      <MapPin size={16} color="var(--color-brand-accent)" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong>Route Service Coverage</strong>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{pickup.city} → {destination.city}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                      <Truck size={16} color="#F59E0B" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong>Cargo & Vehicle Fit</strong>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{packageData.weightKg} kg ({packageData.packageType})</p>
                      </div>
                    </div>
                  </div>
                </div>

                <ConfirmationStep
                  packageData={packageData}
                  pickup={pickup}
                  destination={destination}
                  recipient={recipient}
                  deliveryNote={deliveryNote}
                  selectedProvider={selectedProvider}
                  dispatchMode="auto"
                  onBack={() => setCurrentStep(3)}
                />

                <div style={{ textAlign: 'center', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
                  <button
                    type="button"
                    onClick={() => setShowManualSelection(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-secondary)',
                      fontSize: 'var(--font-size-xs)',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Or choose a logistics provider myself (Advanced)
                  </button>
                </div>
              </div>
            ) : (
              /* OPTIONAL SECONDARY: MANUAL PROVIDER CATALOG SELECTION */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                  <Button variant="ghost" size="sm" onClick={() => setShowManualSelection(false)} leftIcon={<ArrowLeft size={16} />}>
                    Switch to OrderFlow Smart Dispatch
                  </Button>
                </div>

                <ProviderSelectionStep
                  packageData={packageData}
                  pickup={pickup}
                  destination={destination}
                  selectedProvider={selectedProvider}
                  onSelectProvider={(p) => setSelectedProvider(p)}
                  onBack={() => setShowManualSelection(false)}
                  onNext={() => {}}
                />

                {selectedProvider && (
                  <div style={{ marginTop: 'var(--space-6)' }}>
                    <ConfirmationStep
                      packageData={packageData}
                      pickup={pickup}
                      destination={destination}
                      recipient={recipient}
                      deliveryNote={deliveryNote}
                      selectedProvider={selectedProvider}
                      dispatchMode="manual"
                      onBack={() => setSelectedProvider(null)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

