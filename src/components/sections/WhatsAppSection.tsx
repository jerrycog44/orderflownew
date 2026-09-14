import React from 'react';
import { MessageSquare, Monitor, ArrowRight, CheckCircle2 } from 'lucide-react';
import './WhatsAppSection.css';

export const WhatsAppSection: React.FC = () => {
  return (
    <section id="whatsapp-integration" className="section of-wa-section">
      <div className="container">
        <div className="of-wa-grid">
          {/* Content Column */}
          <div className="of-wa-content">
            <div className="of-wa-badge">
              <MessageSquare size={14} className="of-wa-badge-icon" />
              <span>Multi-Channel Workflow</span>
            </div>

            <h2 className="of-wa-title">
              Your deliveries, wherever you work.
            </h2>

            <p className="of-wa-description">
              Start and manage simple delivery tasks through WhatsApp, then use the OrderFlow web app when you need the full workspace.
            </p>

            <div className="of-wa-points">
              <div className="of-wa-point">
                <CheckCircle2 size={16} className="of-wa-check" />
                <div>
                  <strong>Quick & Conversational</strong>
                  <p>Send a message on WhatsApp to initiate pickup requests or check shipment status instantly.</p>
                </div>
              </div>
              <div className="of-wa-point">
                <CheckCircle2 size={16} className="of-wa-check" />
                <div>
                  <strong>Full Desktop Workspace</strong>
                  <p>Access complete dispatch management, detailed rate comparison, and account reports on web.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Conceptual Flow Card */}
          <div className="of-wa-visual-col">
            <div className="of-wa-flow-card">
              {/* Node 1: WhatsApp */}
              <div className="of-wa-node of-wa-node-whatsapp">
                <div className="of-wa-node-icon wa-bg">
                  <MessageSquare size={20} color="#FFFFFF" />
                </div>
                <div className="of-wa-node-info">
                  <span className="of-wa-node-tag">WhatsApp Interface</span>
                  <p className="of-wa-node-title">Create • Check • Track</p>
                  <p className="of-wa-node-sub">Instant updates & conversational actions</p>
                </div>
              </div>

              {/* Connector Arrow */}
              <div className="of-wa-connector">
                <div className="of-wa-line" />
                <div className="of-wa-arrow">
                  <ArrowRight size={14} />
                </div>
                <span className="of-wa-sync-label">Synced to single OrderFlow account</span>
              </div>

              {/* Node 2: Web Workspace */}
              <div className="of-wa-node of-wa-node-web">
                <div className="of-wa-node-icon web-bg">
                  <Monitor size={20} color="#FFFFFF" />
                </div>
                <div className="of-wa-node-info">
                  <span className="of-wa-node-tag">OrderFlow Web App</span>
                  <p className="of-wa-node-title">Full Delivery Workspace</p>
                  <p className="of-wa-node-sub">Fleet options, analytics & complete control</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
