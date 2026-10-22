# OrderFlow — Logistics Marketplace & Smart Dispatch

OrderFlow is a commercial delivery marketplace connecting e-commerce merchants directly with verified logistics providers across Nigeria and emerging markets.

For a comprehensive architectural breakdown and list of all implemented features, please refer to:
**[FEATURES_AND_SYSTEM_OVERVIEW.md](./FEATURES_AND_SYSTEM_OVERVIEW.md)**

---

## Key Highlights

- **Smart Dispatch Engine**: Automated driver matching based on vehicle capacity, coverage zones, and real-time availability.
- **Fraud-Proof Delivery (POD)**: Recipient 4-digit verification PIN with optional courier photo upload.
- **Flexible Payment Modes**: Built-in support for Cash on Delivery (COD), Pay at Pickup, and digital gateways (Interswitch, Paystack, Flutterwave).
- **1-Click WhatsApp Sharing**: Instant customer notifications with pre-composed tracking details and deep links (`wa.me`).
- **Realtime WebSockets**: Live order milestone sync and dispatch alerts with Web Audio synthetic chimes.
- **PWA & Production Optimized**: Installable on Android & iOS, with code-splitting reducing initial JS bundle size by 92.5%.
- **Regulatory Ready**: Integrated terms of service and privacy policies compliant with NDPR and GDPR.

---

## Quick Start

```bash
# Install dependencies
npm install

# Run automated tests
npm test

# Run strict type checking
npm run typecheck

# Run linter
npm run lint

# Build production bundle
npm run build

# Start local development server
npm run dev
```

---

## Documentation

- **Full Features & Architecture Overview**: [FEATURES_AND_SYSTEM_OVERVIEW.md](./FEATURES_AND_SYSTEM_OVERVIEW.md)
- **Database Migrations & Schema**: [src/db/migrations/](./src/db/migrations/)
