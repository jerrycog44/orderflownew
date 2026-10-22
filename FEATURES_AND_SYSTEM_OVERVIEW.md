# OrderFlow — Features & Technical Architecture Overview

> **Version:** 1.0.0 Commercial Launch Readiness  
> **Target Market:** Commercial e-commerce vendors, verified logistics providers, and package recipients across Nigeria and African growth markets.  
> **Core Promise:** Seamless logistics marketplace routing, anti-dispute Proof of Delivery (POD), flexible cash-on-delivery and digital payments, instant WhatsApp communication, and sub-second performance.

---

## 1. Executive Summary

**OrderFlow** is an enterprise-grade commercial logistics marketplace connecting merchants directly with verified delivery providers. The platform eliminates informal dispatch delays, delivery disputes, and payment frictions through smart dispatch routing, real-time tracking, cryptographic Proof of Delivery (POD), and seamless WhatsApp integrations.

```
+---------------------------------------------------------------------------------+
|                                 ORDERFLOW ECOSYSTEM                             |
+---------------------------------------------------------------------------------+
|                                                                                 |
|   +-------------------+       +--------------------+       +----------------+   |
|   | Commercial Vendor | <---> | Smart Dispatch RPC | <---> | Courier Partner|   |
|   +-------------------+       +--------------------+       +----------------+   |
|             |                            |                         |            |
|             v                            v                         v            |
|     [Create Delivery]            [Candidate Queue]         [POD Verification]   |
|   - Package Specs              - Availability check       - 4-Digit PIN code    |
|   - COD / Online               - Vehicle capacity fit     - Handover Photo      |
|   - Photo Proof Req.           - Geo-coverage match       - Cash Collection     |
|             |                            |                         |            |
|             +----------------------------+-------------------------+            |
|                                          |                                      |
|                                          v                                      |
|                             +--------------------------+                        |
|                             | Customer Tracking Hub    |                        |
|                             | - Redacted PII Security  |                        |
|                             | - 4-Digit Handover PIN   |                        |
|                             | - WhatsApp 1-Click Link  |                        |
|                             +--------------------------+                        |
+---------------------------------------------------------------------------------+
```

---

## 2. Comprehensive Features Breakdown

### 2.1 Commercial Vendor Capabilities

1. **Role-Based Authentication & Onboarding**:
   - Secure authentication supporting email/password sessions with offline mock fallback.
   - Dedicated business onboarding collecting trading name, operating city, and commercial category.
2. **4-Step Delivery Creation Wizard**:
   - **Step 1: Package Specifications**: Captures item name, category, package type (box, flyer, sack, pallet), dimensions, fragile goods flag, and special handling instructions.
   - **Step 2: Pickup & Dropoff Routing**: City and address details with contact phone numbers.
   - **Step 3: Summary Review**: Pre-dispatch check of parcel dimensions and recipient contacts.
   - **Step 4: Smart Dispatch vs. Manual Catalog**:
     - *OrderFlow Smart Dispatch (Default)*: Evaluates live provider availability, route service coverage, and vehicle cargo fit to automatically send opportunities to top-ranked couriers.
     - *Manual Provider Catalog (Advanced)*: Allows selecting specific carriers with transparent pricing, SLA transit times, and customer ratings.
3. **Flexible Payment Modes**:
   - **Cash on Delivery (COD)** *(Default)*: Recipient pays the courier in cash or direct bank transfer upon physical handover.
   - **Pay at Pickup**: Vendor settles the delivery fare with the courier at dispatch pickup.
   - **Digital Payment Gateways**: Pre-configured architecture for Interswitch WebPAY, Paystack, and Flutterwave with instant status settlement.
4. **Proof of Delivery (POD) Configuration**:
   - Automatically issues a unique 4-digit recipient verification PIN for every order.
   - Optional toggle: *"Require courier photo upload proof upon package handover"*.
5. **Vendor Management Dashboard (`/vendor/dashboard`)**:
   - Live operational metrics: Total Requests, Pending Dispatch, In Transit, Delivered.
   - Searchable delivery directory with multi-status tabs (`All`, `In Progress`, `In Transit`, `Delivered`).
   - Inline payment tags (`COD`, `Pay at Pickup`, `Prepaid`) displayed directly in directory rows.
6. **Delivery Detail View (`/vendor/deliveries/:id`)**:
   - Full milestone timeline advancement.
   - Payment & Handover Security card showing payment status, 4-digit PIN, and courier photo proof.
   - 1-click WhatsApp customer share button and clipboard link copy.

---

### 2.2 Logistics Provider & Fleet Operations

1. **Service Profile & Availability Controls**:
   - Fleet provider profile capturing vehicle types (Motorcycles, Vans, Trucks), package categories, and coverage territories.
   - Real-time interactive availability toggle (`Available` vs `Busy`) controlling dispatch eligibility.
2. **Real-Time Dispatch Opportunities**:
   - Listens to incoming dispatches via Supabase Realtime WebSockets with local cross-tab fallback.
   - Synthetic Web Audio API notification chimes alert couriers to incoming opportunities without external audio dependencies.
   - Redacted PII: Recipient phone and street address remain hidden until the job is accepted.
3. **Atomic Dispatch Acceptance**:
   - Database row-locking (`FOR UPDATE`) eliminates race conditions and double-assignment when multiple couriers view open opportunities.
   - Decline button routes jobs immediately to the next eligible candidate in the queue.
4. **Active Dispatches & POD Handover Verification**:
   - Couriers can advance delivery state to `in_transit`.
   - Clicking **"Mark Delivered"** opens a dedicated **Proof of Delivery Modal**:
     - **Cash Collection Alert**: On COD orders, alerts the courier to collect the delivery fare (e.g., `₦4,200`) before finalizing handover.
     - **4-Digit Code Input**: Validates the customer's PIN; rejects invalid codes.
     - **Camera / Photo Upload**: Enforces taking or uploading a delivery snapshot when required by the vendor.

---

### 2.3 Customer & Recipient Experience

1. **Public Tracking Hub (`/track/:trackingCode`)**:
   - Accessible without an account by entering any OrderFlow tracking number (e.g. `OF-849201`).
   - **Privacy-by-Design**: Strictly hides customer phone numbers, internal rates, and street addresses from unauthenticated viewers.
2. **Handover Security PIN Display**:
   - Clearly discloses the 4-digit verification code to the recipient with guidance: *"Share this code with your courier only when receiving your package to verify handover"*.
3. **Delivery Milestone Timeline**:
   - Visual step timeline (`Order Created` -> `Dispatching` -> `Provider Matched` -> `In Transit` -> `Delivered`).
4. **Verified Delivery & Photo Proof**:
   - Upon delivery, displays a green verified badge along with the courier's handover photo proof.

---

### 2.4 WhatsApp Commercial Integration

1. **Direct `wa.me` Deep Links**:
   - [whatsapp.ts](file:///c:/orderflownew/src/lib/whatsapp.ts) sanitizes international and Nigerian local phone numbers (e.g. `08012345678` -> `2348012345678`).
2. **Pre-Composed Merchant-to-Customer Notification**:
   ```text
   Hello Chioma Okeke! 👋

   Your delivery of *Leather Sneakers & Denim Jackets* from *Apex Fashion Hub* is being handled via *OrderFlow*.

   📦 Tracking Code: OF-924182
   ⏱ Estimated Transit: 1–2 hours

   🔐 Delivery Verification PIN: 4892
   (Please share this 4-digit code with the courier only when receiving your package)

   You can track your package in real-time here:
   https://orderflow.ng/track/OF-924182

   Thank you for your business!
   ```
3. **Social Media & Rich Card Previews**:
   - [index.html](file:///c:/orderflownew/index.html) includes OpenGraph (`og:title`, `og:image`, `og:description`) and Twitter card tags so links pasted in WhatsApp, Telegram, or Twitter display branded preview cards.

---

### 2.5 Compliance, Stability & PWA Capabilities

1. **Legal & Regulatory Compliance**:
   - [TermsPage.tsx](file:///c:/orderflownew/src/pages/TermsPage.tsx): Commercial logistics terms, dangerous goods restrictions, POD liabilities, dispute windows, and governing law clauses.
   - [PrivacyPage.tsx](file:///c:/orderflownew/src/pages/PrivacyPage.tsx): Nigeria Data Protection Regulation (NDPR) and GDPR compliant privacy notice outlining telemetry, PII masking, retention limits, and data subject rights.
2. **Resilience & Fault Tolerance**:
   - [ErrorBoundary.tsx](file:///c:/orderflownew/src/components/ui/ErrorBoundary.tsx): Intercepts uncaught runtime rendering errors with actionable recovery controls (*Reload Page*, *Return Home*) and technical stack diagnostics.
   - [NotFoundPage.tsx](file:///c:/orderflownew/src/pages/NotFoundPage.tsx): 404 page featuring an interactive tracking search bar so misplaced visitors can track shipments directly.
3. **Progressive Web App (PWA)**:
   - [manifest.json](file:///c:/orderflownew/public/manifest.json): Standalone display mode with `portrait-primary` orientation, `#0F172A` theme color, and application shortcuts (*Track Package*, *Create Delivery*, *Logistics Opportunities*).
   - [icon-192.svg](file:///c:/orderflownew/public/icon-192.svg) & [icon-512.svg](file:///c:/orderflownew/public/icon-512.svg): High-resolution vector icons supporting maskable Android/iOS home-screen installation.
4. **Performance & Route-Level Code Splitting**:
   - Converted all 14 page routes to `React.lazy()` with dynamic imports wrapped in `<Suspense fallback={<PageLoader />}>`.
   - Split vendor chunks in [vite.config.ts](file:///c:/orderflownew/vite.config.ts) (`vendor-react`, `vendor-supabase`).
   - **Initial JS bundle reduced from 726 kB to 54.3 kB (14.4 kB gzipped)** — a **92.5% reduction** in initial download size.

---

## 3. Technical Architecture & File Directory

```
c:\orderflownew\
├── public/
│   ├── favicon.svg               # Vector brand favicon
│   ├── icon-192.svg              # PWA 192px maskable icon
│   ├── icon-512.svg              # PWA 512px maskable icon
│   └── manifest.json             # W3C Web App Manifest
├── src/
│   ├── auth/                     # Authentication service & context provider
│   ├── components/
│   │   ├── auth/                 # ProtectedRoute & PublicOnlyRoute guards
│   │   ├── delivery/             # Wizard steps: Package, Location, Review, Confirmation
│   │   ├── layout/               # Navbar, Footer, AppLayout, PublicLayout
│   │   ├── sections/             # Landing page marketing sections (Hero, WhatsApp, HowItWorks)
│   │   └── ui/                   # Button, Badge, Modal, Input, Toast, ErrorBoundary, PageLoader
│   ├── data/                     # Seed mock data for offline demonstration
│   ├── db/                       # Supabase migration scripts & RLS policy tests
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client initializer & connection detector
│   │   └── whatsapp.ts           # WhatsApp wa.me formatting & notification templates
│   ├── pages/                    # Lazy-loaded route views
│   ├── services/                 # deliveryService, logisticsService, realtimeService
│   ├── styles/                   # Design system tokens and global typography
│   ├── types/                    # Domain TypeScript interfaces derived from PostgreSQL schema
│   ├── App.tsx                   # Code-split routing tree & Suspense boundary
│   └── main.tsx                  # React DOM root wrapped in ErrorBoundary
├── vite.config.ts                # Rollup chunking & PWA build configuration
└── package.json                  # Dependencies, scripts, and test runners
```

---

## 4. Quality Assurance & Verification Summary

| Quality Gate | Tooling | Result | Notes |
|---|---|---|---|
| **Type Checking** | `tsc -b` (Strict Mode) | **PASS** (0 errors) | Zero TypeScript compilation warnings |
| **Linting** | `oxlint` | **PASS** (0 errors) | Verified across 79 files |
| **Unit & Integration Tests**| `vitest run` | **PASS** (82/82 passed) | 10 passing test suites |
| **Production Build** | `vite build` | **PASS** (3.9s) | Clean bundle output in `dist/` |
| **Initial JS Size** | Gzip measurement | **14.4 kB gzipped** | 92.5% reduction from baseline |
| **CI Automation** | GitHub Actions (`ci.yml`) | **Configured** | Runs lint, typecheck, tests, and build on push |

---

## 5. Getting Started & Verification Commands

```bash
# Install dependencies
npm install

# Run automated tests
npm test

# Run strict TypeScript validation
npm run typecheck

# Run code linter
npm run lint

# Compile production bundle
npm run build

# Start local development server
npm run dev
```
