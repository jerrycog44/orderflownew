import React from 'react';
import { Check } from 'lucide-react';
import './StepIndicator.css';

export interface StepIndicatorProps {
  currentStep: number; // 1 to 5
  onStepClick?: (step: number) => void;
}

const STEPS = [
  { step: 1, label: 'Package' },
  { step: 2, label: 'Pickup & Delivery' },
  { step: 3, label: 'Review' },
  { step: 4, label: 'Logistics' },
  { step: 5, label: 'Confirm' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, onStepClick }) => {
  return (
    <div className="of-step-indicator" role="navigation" aria-label="Delivery Creation Progress">
      {STEPS.map((s, idx) => {
        const isCompleted = s.step < currentStep;
        const isActive = s.step === currentStep;

        return (
          <React.Fragment key={s.step}>
            <button
              type="button"
              className={`of-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              onClick={() => isCompleted && onStepClick && onStepClick(s.step)}
              disabled={!isCompleted}
              aria-current={isActive ? 'step' : undefined}
            >
              <div className="of-step-number">
                {isCompleted ? <Check size={14} strokeWidth={2.5} /> : s.step}
              </div>
              <span className="of-step-label">{s.label}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className={`of-step-line ${s.step < currentStep ? 'completed' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
