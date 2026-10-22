import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import './LegalPage.css';

export const PrivacyPage: React.FC = () => {
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
            <Lock size={14} />
            <span>Data Protection & Privacy</span>
          </div>
          <h1 className="of-legal-title">Privacy Policy</h1>
          <p className="of-legal-subtitle">
            OrderFlow is committed to protecting your privacy and securing the personal data 
            of vendors, logistics partners, and package recipients.
          </p>
          <div className="of-legal-meta">
            <span>Effective Date: October 20, 2026</span>
            <span>•</span>
            <span>NDPR & GDPR Compliant</span>
          </div>
        </header>

        {/* Document Content */}
        <div className="of-legal-content">
          <div className="of-legal-notice-box">
            <p>
              <strong>Privacy Architecture Commitment:</strong> OrderFlow implements strict 
              Row-Level Security (RLS) and database-level PII redaction. Recipient phone numbers, 
              private addresses, and vendor financials are <strong>never</strong> exposed on public 
              tracking links or made accessible to unauthorized third parties.
            </p>
          </div>

          <h2>1. Information We Collect</h2>
          <p>
            Depending on how you interact with OrderFlow, we collect the following categories of information:
          </p>

          <h3>A. Account & Profile Information</h3>
          <ul>
            <li><strong>Vendors:</strong> Business name, operating city, contact name, email address, and E.164-formatted phone number.</li>
            <li><strong>Logistics Providers:</strong> Company name, registered fleet vehicles, operating coverage areas, driver profiles, and availability status.</li>
          </ul>

          <h3>B. Shipment & Delivery Information</h3>
          <ul>
            <li><strong>Parcel Specs:</strong> Product category, weight, dimensions, fragility, and special handling instructions.</li>
            <li><strong>Pickup & Destination:</strong> Physical addresses, geographic coordinates, and recipient contact information (name and telephone number).</li>
          </ul>

          <h3>C. Technical & Usage Data</h3>
          <ul>
            <li>Device identifiers, browser types, IP addresses, session timestamps, and system performance telemetry.</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We process collected data solely for legitimate business purposes:</p>
          <ul>
            <li><strong>Dispatch Routing & Matching:</strong> Evaluating parcel criteria against courier service areas and vehicle capacities.</li>
            <li><strong>Delivery Fulfillment:</strong> Enabling assigned couriers to navigate to pickup locations and contact recipients upon arrival.</li>
            <li><strong>Real-Time Tracking:</strong> Providing live status notifications via WhatsApp, SMS, and web tracking pages.</li>
            <li><strong>Security & Anti-Fraud:</strong> Enforcing audit trails, verifying proof of delivery (POD), and serializing dispatch offers.</li>
          </ul>

          <h2>3. Public Tracking Security & PII Protection</h2>
          <p>
            When a merchant shares a public tracking link (e.g., <code>/track/OF-XXXXXX</code>) with an end-customer:
          </p>
          <table className="of-legal-table">
            <thead>
              <tr>
                <th>Data Field</th>
                <th>Public Visibility</th>
                <th>Security Protection</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Tracking Code & Status</td>
                <td>Visible</td>
                <td>Non-sensitive lifecycle indicator</td>
              </tr>
              <tr>
                <td>Estimated Transit Time</td>
                <td>Visible</td>
                <td>General window (e.g. &ldquo;Same Day&rdquo;)</td>
              </tr>
              <tr>
                <td>Assigned Courier Brand</td>
                <td>Visible</td>
                <td>Public company name & logo</td>
              </tr>
              <tr>
                <td>Recipient Phone & Address</td>
                <td><strong>Hidden</strong></td>
                <td>Redacted by database security policy</td>
              </tr>
              <tr>
                <td>Vendor Financials / Costs</td>
                <td><strong>Hidden</strong></td>
                <td>Restricted strictly to the authenticated vendor</td>
              </tr>
            </tbody>
          </table>

          <h2>4. Information Sharing & Third Parties</h2>
          <p>We never sell your personal data. Data is shared strictly under the following operational circumstances:</p>
          <ul>
            <li><strong>With Assigned Logistics Providers:</strong> The courier assigned to an order receives the recipient&rsquo;s delivery address and phone number for the sole purpose of executing transit. Prospective couriers reviewing unaccepted offers see only sanitized area data.</li>
            <li><strong>Payment Gateways:</strong> For digital transactions, billing information is processed directly by PCI-DSS certified payment processors (e.g., Interswitch, Paystack). We do not store credit card credentials.</li>
            <li><strong>Legal & Regulatory Authorities:</strong> We may disclose data if legally required to comply with court orders or law enforcement investigations concerning prohibited items.</li>
          </ul>

          <h2>5. Data Security & Storage</h2>
          <p>
            OrderFlow employs enterprise-grade security standards to safeguard your data:
          </p>
          <ul>
            <li><strong>Encrypted Transport:</strong> All data in transit is protected using TLS 1.3 encryption. Realtime WebSockets operate over secure WSS channels.</li>
            <li><strong>Row-Level Security (RLS):</strong> Multi-tenant isolation is enforced at the database kernel level in PostgreSQL, preventing cross-tenant data leakage.</li>
            <li><strong>Authentication Tokens:</strong> Sessions use short-lived JWT tokens with automated background refresh.</li>
          </ul>

          <h2>6. Data Retention</h2>
          <p>
            Delivery records and status audit histories are retained for as long as your account remains active or as required by tax and commercial regulations (typically up to 6 years for financial transaction histories).
          </p>

          <h2>7. Your Rights (NDPR & GDPR)</h2>
          <p>
            Under the Nigerian Data Protection Regulation (NDPR) and international privacy frameworks, you have the right to:
          </p>
          <ul>
            <li>Request access to the personal data we hold about you.</li>
            <li>Request correction of inaccurate or incomplete information.</li>
            <li>Request deletion of your personal data when no longer required for regulatory obligations.</li>
            <li>Object to or restrict the processing of your data.</li>
          </ul>

          <h2>8. Updates to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time to reflect platform enhancements or regulatory changes. We will notify active users of material revisions via email or dashboard announcement.
          </p>

          <h2>9. Data Protection Officer (DPO) Contact</h2>
          <p>
            If you have questions regarding this Privacy Policy or wish to exercise your data subject rights, please contact our Data Protection Officer:
            <br />
            <strong>Email:</strong> privacy@orderflow.ng
            <br />
            <strong>Office:</strong> OrderFlow Logistics Technologies, Victoria Island, Lagos, Nigeria.
          </p>
        </div>
      </div>
    </div>
  );
};
