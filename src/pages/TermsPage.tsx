import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import './LegalPage.css';

export const TermsPage: React.FC = () => {
  return (
    <div className="of-legal-page">
      <div className="of-legal-container">
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>

        {/* Header */}
        <header className="of-legal-header">
          <div className="of-legal-badge">
            <FileText size={14} />
            <span>Commercial Agreement</span>
          </div>
          <h1 className="of-legal-title">Terms of Service</h1>
          <p className="of-legal-subtitle">
            These terms govern your access to and use of the OrderFlow logistics platform, dispatch services, 
            tracking interfaces, and marketplace features.
          </p>
          <div className="of-legal-meta">
            <span>Effective Date: October 20, 2026</span>
            <span>•</span>
            <span>Version 1.0</span>
          </div>
        </header>

        {/* Document Content */}
        <div className="of-legal-content">
          <div className="of-legal-notice-box">
            <p>
              <strong>Important Notice:</strong> OrderFlow provides technological routing, matching, 
              and dispatch infrastructure connecting commercial Vendors with independent Logistics Providers. 
              By creating an account, booking a shipment, or accepting a dispatch offer, you enter into a legally 
              binding agreement under the terms set forth below.
            </p>
          </div>

          <h2>1. Platform Overview & Definitions</h2>
          <p>
            OrderFlow Technologies (&ldquo;OrderFlow&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates a digital marketplace 
            and dispatch coordination platform.
          </p>
          <ul>
            <li><strong>&ldquo;Vendor&rdquo;</strong> refers to any business, retailer, merchant, or individual who posts shipments and delivery requests.</li>
            <li><strong>&ldquo;Logistics Provider&rdquo;</strong> refers to verified fleet operators, dispatch couriers, and delivery drivers who accept and execute parcel transit.</li>
            <li><strong>&ldquo;Shipment&rdquo;</strong> or <strong>&ldquo;Delivery&rdquo;</strong> refers to the goods, packages, or parcels submitted by a Vendor for transport.</li>
            <li><strong>&ldquo;Recipient&rdquo;</strong> refers to the designated end-customer or consignee receiving the shipment at the destination address.</li>
          </ul>

          <h2>2. Account Registration & User Obligations</h2>
          <p>
            Users must be at least 18 years old and legally authorized to conduct commercial trade in Nigeria or their country of operation.
          </p>
          <ul>
            <li><strong>Accuracy of Information:</strong> You agree to provide accurate, current, and complete business details during signup and onboarding.</li>
            <li><strong>Account Security:</strong> You are solely responsible for maintaining the confidentiality of your credentials and all activities occurring under your account.</li>
            <li><strong>Role Separation:</strong> Users registered as Vendors may not act as couriers unless onboarded as a registered Logistics Provider.</li>
          </ul>

          <h2>3. Shipment Booking & Dispatch Lifecycle</h2>
          <p>
            When a Vendor creates a delivery request:
          </p>
          <ol>
            <li><strong>Opportunity Distribution:</strong> OrderFlow Smart Dispatch presents the offer to suitable, available Logistics Providers according to route coverage, capacity, and performance rank.</li>
            <li><strong>Time-to-Live (TTL):</strong> Targeted dispatch opportunities have an active response window (typically 120 seconds). Unaccepted offers are automatically redistributed to the next qualified candidate.</li>
            <li><strong>Binding Acceptance:</strong> Once a Logistics Provider accepts an offer or is manually confirmed by a Vendor, an operational delivery contract is established between the Vendor and the Provider.</li>
          </ol>

          <h2>4. Prohibited & Restricted Items</h2>
          <p>
            Vendors are strictly prohibited from submitting any of the following items for transit through OrderFlow:
          </p>
          <ul>
            <li>Illegal narcotics, controlled substances, and contraband goods.</li>
            <li>Firearms, ammunition, explosives, and weapons.</li>
            <li>Hazardous materials, corrosive chemicals, and toxic bio-waste.</li>
            <li>Physical cash, bullion, precious metals, and unregistered bearer negotiable instruments.</li>
            <li>Live animals or human remains.</li>
          </ul>
          <p>
            Logistics Providers retain the right to inspect packages upon pickup if tampering or prohibited contents are reasonably suspected.
          </p>

          <h2>5. Pricing, Rates & Payment Settlement</h2>
          <p>
            Delivery rates are calculated based on parcel classification, weight, pickup/dropoff distance, and courier tier:
          </p>
          <ul>
            <li><strong>Payment Modes:</strong> Deliveries may be settled via Prepaid Digital Checkout (Cards, Bank Transfer) or Cash on Delivery (COD) where agreed upon by both parties.</li>
            <li><strong>Fare Adjustments:</strong> If a package's physical weight or volume substantially exceeds the parameters entered in the booking wizard, the courier may request a price recalculation prior to transit.</li>
            <li><strong>Provider Remittance:</strong> Completed delivery settlements are credited to the Provider&rsquo;s registered payout account according to the agreed settlement cycle.</li>
          </ul>

          <h2>6. Proof of Delivery (POD) & Handover Verification</h2>
          <p>
            To eliminate delivery disputes and protect all parties:
          </p>
          <ul>
            <li><strong>Verification Code:</strong> Handover must be validated using the 4-digit recipient verification OTP generated upon order confirmation.</li>
            <li><strong>Photo Proof:</strong> Where requested by the Vendor, the courier must capture and upload a clear photograph showing the delivered parcel at the recipient&rsquo;s location.</li>
            <li><strong>Delivery Completion:</strong> A delivery is legally recognized as fulfilled once the verification code is validated or photo proof is uploaded and confirmed.</li>
          </ul>

          <h2>7. Transit Liability, Lost or Damaged Goods</h2>
          <p>
            OrderFlow acts as an intermediary technology platform. Responsibility for physical custody, transit safety, and timely arrival rests with the designated Logistics Provider:
          </p>
          <ul>
            <li>Logistics Providers agree to exercise commercial standard of care when handling parcels.</li>
            <li>In the event of package loss, damage, or theft during active transit, claims must be lodged through OrderFlow Resolution within 48 hours of expected delivery.</li>
            <li>Logistics Providers are liable for provable damage up to the declared value of the parcel, subject to carrier insurance limitations.</li>
          </ul>

          <h2>8. Cancellation Policy</h2>
          <p>
            A Vendor may cancel a delivery request without penalty before a Logistics Provider has arrived at the pickup location. If cancellation occurs after the courier has departed for pickup, a standard dispatch mobilization fee may apply.
          </p>

          <h2>9. Termination & Suspension</h2>
          <p>
            OrderFlow reserves the right to suspend or terminate accounts that breach these terms, engage in fraudulent transactions, maintain chronic SLA failure rates, or compromise marketplace integrity.
          </p>

          <h2>10. Governing Law & Dispute Resolution</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any controversy or claim arising out of this agreement shall be settled through commercial arbitration in Lagos, Nigeria.
          </p>

          <h2>11. Contact Us</h2>
          <p>
            For legal inquiries or dispute resolution assistance, contact our compliance team at:
            <br />
            <strong>Email:</strong> legal@orderflow.ng
            <br />
            <strong>Support:</strong> support@orderflow.ng
          </p>
        </div>
      </div>
    </div>
  );
};
