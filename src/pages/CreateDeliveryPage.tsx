import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { PackageDetails, LocationPoint, LogisticsProvider } from '../types';
import { StepIndicator } from '../components/delivery/StepIndicator';
import { PackageStep } from '../components/delivery/PackageStep';
import { LocationStep } from '../components/delivery/LocationStep';
import { ReviewStep } from '../components/delivery/ReviewStep';
import { ProviderSelectionStep } from '../components/delivery/ProviderSelectionStep';
import { ConfirmationStep } from '../components/delivery/ConfirmationStep';
import './CreateDeliveryPage.css';

export const CreateDeliveryPage: React.FC = () => {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);

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

  const handleProviderNext = () => {
    if (selectedProvider) {
      setCurrentStep(5);
    }
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
          Connect your shipment with verified logistics providers in seconds.
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
          <ProviderSelectionStep
            packageData={packageData}
            pickup={pickup}
            destination={destination}
            selectedProvider={selectedProvider}
            onSelectProvider={(p) => setSelectedProvider(p)}
            onBack={() => setCurrentStep(3)}
            onNext={handleProviderNext}
          />
        )}

        {currentStep === 5 && selectedProvider && (
          <ConfirmationStep
            packageData={packageData}
            pickup={pickup}
            destination={destination}
            recipient={recipient}
            deliveryNote={deliveryNote}
            selectedProvider={selectedProvider}
            onBack={() => setCurrentStep(4)}
          />
        )}
      </div>
    </div>
  );
};
