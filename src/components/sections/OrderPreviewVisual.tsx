import React, { useState } from 'react';
import { Check, Clock, MapPin, Package, Radio, Zap, Users, KeyRound, Bike } from 'lucide-react';
import './landing.css';

type PreviewTab = 'create' | 'dispatch' | 'track';

const TABS: { id: PreviewTab; label: string }[] = [
  { id: 'create', label: 'Create' },
  { id: 'dispatch', label: 'Dispatch' },
  { id: 'track', label: 'Track' },
];

const TIMELINE = [
  { label: 'Order created', state: 'done' },
  { label: 'Dispatching', state: 'done' },
  { label: 'Provider matched', state: 'done' },
  { label: 'In transit', state: 'active' },
  { label: 'Delivered', state: 'todo' },
] as const;

/**
 * Hero product preview: a phone-framed illustration of the merchant app plus a
 * rider offer card. It is purely illustrative (clearly labelled as such) — the
 * only interactive elements are the three tabs used to switch screens.
 */
export const OrderPreviewVisual: React.FC = () => {
  const [tab, setTab] = useState<PreviewTab>('create');

  return (
    <figure className="lp-preview" aria-label="Illustrative preview of the OrderFlow app">
      <div className="lp-phone">
        <div className="lp-phone-notch" aria-hidden="true" />

        <div className="lp-phone-header">
          <span className="lp-phone-title">
            {tab === 'create' && 'New delivery'}
            {tab === 'dispatch' && 'Choose dispatch'}
            {tab === 'track' && 'Delivery status'}
          </span>
          <span className="lp-phone-badge">Merchant</span>
        </div>

        <div role="tablist" aria-label="Preview screens" className="lp-phone-tabs">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              type="button"
              id={`preview-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`preview-panel-${id}`}
              className={`lp-phone-tab ${tab === id ? 'is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`preview-panel-${tab}`}
          aria-labelledby={`preview-tab-${tab}`}
          className="lp-phone-body"
          key={tab}
        >
          {tab === 'create' && (
            <>
              <div className="lp-stepper" aria-hidden="true">
                <span className="is-on" />
                <span className="is-on" />
                <span />
                <span />
              </div>
              <div className="lp-field">
                <Package size={16} aria-hidden="true" />
                <div>
                  <small>Package</small>
                  <strong>2 × Parcel · 1.5 kg</strong>
                </div>
              </div>
              <div className="lp-field">
                <MapPin size={16} aria-hidden="true" />
                <div>
                  <small>Pickup</small>
                  <strong>Bodija, Ibadan</strong>
                </div>
              </div>
              <div className="lp-field">
                <MapPin size={16} aria-hidden="true" className="is-dest" />
                <div>
                  <small>Drop-off</small>
                  <strong>Ring Road, Ibadan</strong>
                </div>
              </div>
              <div className="lp-phone-cta" aria-hidden="true">Continue to provider</div>
            </>
          )}

          {tab === 'dispatch' && (
            <>
              <div className="lp-option is-selected">
                <Zap size={18} aria-hidden="true" />
                <div>
                  <strong>Smart Dispatch</strong>
                  <small>Offer goes to the best-matched available rider</small>
                </div>
                <span className="lp-chip">Recommended</span>
              </div>
              <div className="lp-option">
                <Users size={18} aria-hidden="true" />
                <div>
                  <strong>Choose a provider</strong>
                  <small>Pick from providers covering your route</small>
                </div>
              </div>
              <div className="lp-estimate">
                <span>Estimated delivery</span>
                <strong>₦3,500 · Same day</strong>
              </div>
              <div className="lp-phone-cta" aria-hidden="true">Confirm delivery</div>
            </>
          )}

          {tab === 'track' && (
            <>
              <ol className="lp-timeline">
                {TIMELINE.map(({ label, state }) => (
                  <li key={label} className={`is-${state}`}>
                    <span className="lp-timeline-dot" aria-hidden="true">
                      {state === 'done' && <Check size={10} />}
                    </span>
                    <span>{label}</span>
                  </li>
                ))}
              </ol>
              <div className="lp-pin">
                <KeyRound size={16} aria-hidden="true" />
                <span>Customer shares a 4-digit PIN at handover</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="lp-floating lp-floating-offer" aria-hidden="true">
        <div className="lp-floating-head">
          <span className="lp-live-dot" />
          <strong>New delivery offer</strong>
        </div>
        <p>
          <Bike size={14} /> Bodija → Ring Road
        </p>
        <p>
          <Clock size={14} /> Same day
        </p>
        <div className="lp-floating-actions">
          <span className="is-decline">Decline</span>
          <span className="is-accept">Accept</span>
        </div>
      </div>

      <div className="lp-floating lp-floating-live" aria-hidden="true">
        <Radio size={14} />
        <span>Status updates in real time</span>
      </div>

      <figcaption className="lp-preview-caption">Illustrative preview with sample data</figcaption>
    </figure>
  );
};
