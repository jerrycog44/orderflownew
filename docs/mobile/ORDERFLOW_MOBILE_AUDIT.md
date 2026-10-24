# OrderFlow Mobile App Audit & Product Baseline

> **Version:** 1.0.0  
> **Date:** October 2026  
> **Target Release:** Android Mobile App (Capacitor-powered) with iOS architecture compatibility  
> **Status:** Phase 1 Complete — Baseline Assessment  

---

## 1. Executive Summary

OrderFlow is a commercial logistics marketplace and dispatch platform operating in Nigeria (primary coverage: Lagos, Ibadan, Abeokuta, Abuja, Port Harcourt). It connects commercial merchants (Vendors) with verified courier fleets and independent dispatch riders (Logistics Providers).

This audit establishes the product, architectural, and visual baseline of the existing web application prior to executing the phase-gated mobile redesign. The application is built on React 19, TypeScript, Vite, and Supabase. All core business operations—atomic multi-step delivery dispatch, PII protection, opportunity concurrency locks, Proof-of-Delivery PIN verification, customer tracking, and WhatsApp sharing—are implemented, tested (83 passing automated tests), and fully operational.

However, the user interface is currently desktop/responsive web-oriented. Transforming it into an operational, mobile-first mobile app requires resolving key mobile ergonomic bottlenecks: replacing top-header desktop navigation with role-aware bottom tabs, eliminating dense horizontal tables in favor of touchable card lists, handling mobile safe-area insets, standardizing touch targets (min 48px), and preparing for Capacitor native runtime integration.

---

## 2. Current Architecture & Technology Stack

### 2.1 Core Technology Stack
- **UI Framework:** React `19.2.8` with React DOM `19.2.8`.
- **Language & Type System:** TypeScript `~6.0.2` (`strict: true`, `noUnusedLocals: true`, `target: es2023`).
- **Build Tooling:** Vite `8.3.0` with `@vitejs/plugin-react` and optimized Rollup chunk splitting (`vendor-react`, `vendor-supabase`).
- **Client Routing:** `react-router-dom` `7.18.3` using `BrowserRouter` with code-split lazy loading (`React.lazy()` + `Suspense` with accessible `<PageLoader />`).
- **Icons & Graphics:** `lucide-react` `1.45.0` and custom scalable vector assets (`favicon.svg`, `icons.svg`, `icon-192.svg`, `icon-512.svg`).
- **Backend-as-a-Service:** Supabase (`@supabase/supabase-js` `^2.117.0`) providing PostgreSQL database, Auth, Storage, and Realtime WebSockets.
- **Offline / Local Dev Simulation:** Hybrid architecture using `isSupabaseConfigured` flag. When unconfigured or offline, automatically switches to in-memory/`localStorage` mock simulation with custom DOM events (`window.dispatchEvent`) and synthetic Web Audio chimes (`AudioContext`).
- **Testing Suite:** Vitest `5.0.5`, `@testing-library/react` `16.3.3`, `@testing-library/jest-dom` `7.0.1`, and `@electric-sql/pglite` `0.5.10` for embedded Postgres transaction testing.
- **Linter:** Oxlint `1.81.0`.

### 2.2 Existing Capacitor & Native State
- **Capacitor Configuration:** None currently present in the repository (`capacitor.config.*` and `@capacitor/*` packages are absent).
- **Native Directories:** Neither `/android` nor `/ios` directories exist yet.
- **PWA Assets:** Existing Web App Manifest (`public/manifest.json`), theme color tags (`#0F172A`), and maskable vector icons (`192x192`, `512x512`) are already present in `public/`.

---

## 3. Existing Routes, Roles & Navigation Architecture

### 3.1 User Roles & Permissions
OrderFlow enforces two primary operational roles stored in `profiles.role` (`user_role` ENUM):
1. **`vendor` (Merchant):** Commercial retailers creating package dispatch requests, viewing candidate provider bids, tracking active shipments, managing handover PIN codes, and sharing WhatsApp tracking links.
2. **`logistics_provider` (Courier / Rider):** Fleet operators and individual dispatch riders managing real-time availability (`available`, `busy`, `unavailable`), receiving targeted dispatch offers, browsing open marketplace opportunities, claiming jobs under atomic row locks, and executing package pickup and Proof-of-Delivery verification.

### 3.2 Route Map & Route Guards

| Route Pattern | Protection Guard | Layout Wrapper | Verified Purpose |
|---|---|---|---|
| `/` | Public | `PublicLayout` | Marketing landing page with hero, value props, and public footer. |
| `/track` | Public | `PublicLayout` | Public order tracking search input. |
| `/track/:trackingCode` | Public | `PublicLayout` | Milestone tracking view for customers (unauthenticated access). |
| `/terms` | Public | `PublicLayout` | Commercial logistics terms and clauses. |
| `/privacy` | Public | `PublicLayout` | Data protection and PII handling policy. |
| `/login` | `PublicOnlyRoute` | `AuthLayout` | Email/password sign-in with validation and error banners. |
| `/signup` | `PublicOnlyRoute` | `AuthLayout` | New account registration with auto profile provisioning. |
| `/forgot-password` | `PublicOnlyRoute` | `AuthLayout` | Password reset request form. |
| `/role-selection` | `ProtectedRoute` | Standalone Shell | Post-signup onboarding step: Select Vendor or Logistics Provider. |
| `/onboarding/vendor` | `ProtectedRoute` (vendor) | `AuthLayout` | Merchant profile setup: Business name, category, city. |
| `/onboarding/provider` | `ProtectedRoute` (provider) | `AuthLayout` | Fleet setup: Company name, coverage area, vehicles, categories. |
| `/vendor/dashboard` | `ProtectedRoute` (vendor) | `AppLayout` | Merchant workspace: order list, metrics, status filters, search. |
| `/vendor/deliveries/create` | `ProtectedRoute` (vendor) | Standalone Shell | 4-step wizard: Package → Location → Review → Dispatch Mode. |
| `/vendor/deliveries/:id` | `ProtectedRoute` (vendor) | Standalone Shell | Order detail: timeline, recipient details, Handover PIN, WhatsApp link. |
| `/logistics/dashboard` | `ProtectedRoute` (provider) | `AppLayout` | Provider workspace: availability toggle, targeted offers, job list, POD. |
| `/404`, `*` | Public | Standalone Shell | Accessible error screen with redirect buttons. |

---

## 4. Feature Verification & Implementation Status

| Feature Domain | Implementation Location | Verified Status | Evidence & Contracts |
|---|---|---|---|
| **Auth & Session** | [`src/auth/authService.ts`](file:///c:/orderflownew/src/auth/authService.ts) | **Verified Live & Offline** | Real Supabase session management + self-healing profile creation via trigger [`002_fix_auth_flow.sql`](file:///c:/orderflownew/supabase/migrations/002_fix_auth_flow.sql). |
| **Atomic Dispatch RPC** | [`supabase/migrations/004_...sql`](file:///c:/orderflownew/supabase/migrations/004_atomic_dispatch_and_security_hardening.sql#L755) | **Verified PostgreSQL** | `create_delivery_transactional` creates delivery, package details, candidate queue, and tracking code in 1 transaction. |
| **Smart Dispatch Matching** | [`src/services/logisticsService.ts`](file:///c:/orderflownew/src/services/logisticsService.ts#L82) | **Verified Algorithm** | Shortlists and ranks providers using vehicle capacity, package weight/dimensions, and dynamic availability. |
| **PII Redaction** | [`supabase/migrations/004_...sql`](file:///c:/orderflownew/supabase/migrations/004_atomic_dispatch_and_security_hardening.sql#L932) | **Verified PostgreSQL** | `get_marketplace_opportunities` masks recipient name and phone until an opportunity is accepted. |
| **Opportunity Concurrency** | [`supabase/migrations/004_...sql`](file:///c:/orderflownew/supabase/migrations/004_atomic_dispatch_and_security_hardening.sql#L560) | **Verified PostgreSQL** | `accept_delivery_opportunity` takes `FOR UPDATE` lock, prevents double-acceptance, and handles expiry. |
| **Status State Machine** | [`supabase/migrations/004_...sql`](file:///c:/orderflownew/supabase/migrations/004_atomic_dispatch_and_security_hardening.sql#L224) | **Verified PostgreSQL** | `transition_delivery_status` validates matrix transitions and records history notes. |
| **Proof of Delivery (POD)** | [`src/pages/ProviderDashboardPage.tsx`](file:///c:/orderflownew/src/pages/ProviderDashboardPage.tsx#L35) | **Verified UI & Logic** | 4-digit handover PIN verification and mandatory photo upload check before marking order as `delivered`. |
| **WhatsApp Customer Share** | [`src/lib/whatsapp.ts`](file:///c:/orderflownew/src/lib/whatsapp.ts) | **Verified Utility** | Formats Nigerian phone numbers (`234...`) and generates pre-composed tracking links (`wa.me`). |
| **Realtime WebSockets** | [`src/services/realtimeService.ts`](file:///c:/orderflownew/src/services/realtimeService.ts) | **Verified WebSocket** | Listens to `deliveries` and `dispatch_opportunities` changes; plays Web Audio API notification chimes. |

---

## 5. Reusable Components & Business Logic

### 5.1 UI Foundation Components ([`src/components/ui/`](file:///c:/orderflownew/src/components/ui))
- **`Button`:** Supports `primary`, `secondary`, `outline`, `ghost`, and `danger` variants, `sm`/`md`/`lg` sizes, `isLoading` spinner state, and left/right icons.
- **`Input` / `Textarea` / `Select`:** Styled form controls with floating labels, error text support, and left icon integration.
- **`Badge`:** Semantic status badges (`brand`, `success`, `warning`, `error`, `neutral`, `info`).
- **`Card`:** Container component with header, content, and footer subcomponents.
- **`Modal`:** Accessible backdrop modal with escape-key and click-outside listeners.
- **`Toast` / `useToast`:** Context-driven notification system with automatic timeout dismissal.
- **`ErrorBoundary`:** Top-level class component catching runtime errors and providing reload/home recovery actions.
- **`PageLoader` & `Spinner`:** Accessible loading state indicators.

### 5.2 Delivery Domain Components ([`src/components/delivery/`](file:///c:/orderflownew/src/components/delivery))
- **`StepIndicator`:** Visual progress bar for delivery wizard (Steps 1–4).
- **`PackageStep`:** Form inputs for package description, category, type, weight, dimensions, and fragile flag.
- **`LocationStep`:** Pickup address, destination city, recipient name, phone, and delivery notes.
- **`ReviewStep`:** Pre-submission confirmation summary.
- **`ProviderSelectionStep`:** Live and seed courier candidate cards with ratings, turnaround time, and price.
- **`ProviderDetailModal`:** Detailed carrier inspection modal showing fleet capacity and service areas.
- **`ConfirmationStep`:** Transaction confirmation card with generated Handover PIN, tracking code, and WhatsApp share button.

---

## 6. Current Mobile Usability Problems

Through hands-on inspection of the UI components and stylesheets, the following mobile ergonomics issues were identified:

1. **Desktop-Oriented Navigation Header:**
   [`AppLayout.tsx`](file:///c:/orderflownew/src/components/layout/AppLayout.tsx) renders a desktop horizontal navbar with sticky positioning. On mobile screens (`< 640px`), it hides user details and badges, squeezing the brand logo and account menu into a crowded top strip. There is **no bottom navigation bar**, violating modern mobile navigation ergonomics where primary destinations should be within the thumb zone.

2. **Dense Multi-Column Layouts:**
   [`VendorDashboardPage.tsx`](file:///c:/orderflownew/src/pages/VendorDashboardPage.tsx) renders a multi-column metrics grid (`repeat(2, 1fr)`) and a wide delivery list designed like a desktop table. On smaller phone screens (360px–390px), text truncation and crowded metadata degrade readability.

3. **Sub-Optimal Touch Targets:**
   Filter pills in both dashboards (`.of-filter-pill` in `VendorDashboardPage.css` and `.of-availability-pill` in `ProviderDashboardPage.css`) have small vertical tap areas (padding: `4px 10px`, height: `~28px`), making them difficult to tap accurately on mobile touchscreens without accidental mis-taps. Recommended mobile minimum is `44px × 44px` (or `48px × 48px`).

4. **Desktop Modal Dialogs Instead of Bottom Sheets:**
   Modals ([`Modal.tsx`](file:///c:/orderflownew/src/components/ui/Modal.tsx), `ProviderDetailModal.tsx`, and the POD Verification Modal) center themselves vertically on screen with fixed widths. On mobile devices, centered modals feel unnatural, trap keyboard focus awkwardly, and are difficult to dismiss with one hand compared to mobile-native bottom sheets.

5. **Lack of Safe-Area Padding:**
   Neither `global.css` nor layout components account for mobile hardware cutouts, iPhone Dynamic Island/notches, or Android navigation bars (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`). Fixed headers and footers risk overlapping system UI elements.

6. **Long Form Scroll Fatigue in Delivery Wizard:**
   [`CreateDeliveryPage.tsx`](file:///c:/orderflownew/src/pages/CreateDeliveryPage.tsx) renders full forms on single pages without sticky mobile bottom action buttons ("Next", "Back"), forcing users to scroll to the bottom of the screen repeatedly after filling in inputs.

---

## 7. Known UI Inconsistencies

1. **Inline Styles vs. Modular CSS:**
   Components like [`ConfirmationStep.tsx`](file:///c:/orderflownew/src/components/delivery/ConfirmationStep.tsx) and [`CustomerTrackingPage.tsx`](file:///c:/orderflownew/src/pages/CustomerTrackingPage.tsx) contain large blocks of inline `style={{ ... }}` objects alongside external `.css` files, creating style duplication and preventing centralized token management.
2. **Hardcoded Color Hex Codes:**
   Multiple components use raw hex values (e.g. `#10B981`, `#059669`, `#DC2626`, `#F59E0B`, `#FAF9FE`) instead of the CSS variables defined in [`src/styles/theme.css`](file:///c:/orderflownew/src/styles/theme.css) (`--color-status-success-text`, `--color-status-error-text`, etc.).
3. **Inconsistent Container Border Radii:**
   Containers alternate between `var(--radius-md)` (8px), `var(--radius-lg)` (12px), `var(--radius-xl)` (16px), and hardcoded `borderRadius: '16px'`.
4. **Header Height & Spacing Discrepancies:**
   `PublicLayout` (`Navbar.tsx`) uses a 72px navbar with marketing links, whereas `AppLayout` uses a 64px header. While appropriate for desktop, on mobile a unified, compact app header standard is needed.

---

## 8. Authentication & Authorization Considerations

- **Role Routing Guard:** [`ProtectedRoute.tsx`](file:///c:/orderflownew/src/components/auth/ProtectedRoute.tsx) reliably intercepts unauthenticated or un-onboarded users and redirects them to `/role-selection` or `/onboarding/:role`.
- **Workspace Switcher:** [`AppLayout.tsx`](file:///c:/orderflownew/src/components/layout/AppLayout.tsx#L79-L91) allows switching between Vendor and Provider workspaces by updating the database profile. In a mobile environment, this action should be placed cleanly in a dedicated Profile/Settings tab or drawer rather than a desktop dropdown.
- **Anonymous Tracking:** `/track/:trackingCode` must remain completely public and accessible without authentication so that customers receiving tracking links via SMS or WhatsApp can inspect delivery status without installing or logging into the app.

---

## 9. Supabase & Realtime Considerations for Mobile

- **WebSocket Resilience:** The mobile environment frequently suspends background WebSockets when the device sleeps, enters low-power mode, or switches apps. [`realtimeService.ts`](file:///c:/orderflownew/src/services/realtimeService.ts) must re-synchronize active queries upon app resume/foreground events.
- **Audio Chime on Mobile:** [`playNotificationChime()`](file:///c:/orderflownew/src/services/realtimeService.ts#L22) uses Web Audio API synthesis. Mobile browsers and native WebViews often block synthetic audio playback until after the user's first interactive touch gesture. The current `try { ... } catch` safely prevents crashes, but a native haptic vibration fallback (via Capacitor Haptics) will provide more reliable physical feedback for delivery opportunities.

---

## 10. Capacitor Compatibility Risks

1. **Android Hardware / Gesture Back Button:**
   Vite SPAs running inside Capacitor do not listen to Android native back events by default. Without Capacitor `@capacitor/app` `backButton` listeners, pressing back on an Android device exits the application rather than navigating back in React Router or closing an active modal/sheet.
2. **Keyboard Resizing & Viewport Behavior:**
   When an Android virtual keyboard opens, WebViews can distort flex containers or push sticky buttons off screen. The Android manifest and Capacitor Keyboard plugin (`@capacitor/keyboard`) must be configured to resize the webview cleanly without compressing app navigation bars.
3. **External WhatsApp & Phone Links:**
   [`whatsapp.ts`](file:///c:/orderflownew/src/lib/whatsapp.ts) generates `https://wa.me/...` URLs and `tel:...` protocols. In a native WebView, navigating directly to these URLs can fail unless Android Intent permissions (`intent:`, `whatsapp:`) and navigation allowlists are configured in `capacitor.config.ts`.
4. **Camera & Photo Proof Upload:**
   [`ProviderDashboardPage.tsx`](file:///c:/orderflownew/src/pages/ProviderDashboardPage.tsx) currently uses HTML `<input type="file" accept="image/*" />` for package handover photos. In native Capacitor, this functions via standard file picker, but direct integration with `@capacitor/camera` will deliver a smoother native camera capture experience.

---

## 11. Existing Build & Test Status

Prior to documenting this baseline, the following project checks were executed and verified:

```bash
# 1. TypeScript Static Typecheck
npm run typecheck
# Result: PASSED (tsc -b exited with 0 errors)

# 2. Automated Test Suite
npm test
# Result: PASSED (83 passed across 10 test files)
# - src/services/__tests__/deliveryService.live.test.ts (8 passed)
# - src/services/__tests__/paymentAndPod.test.ts (7 passed)
# - src/services/__tests__/deliveryService.test.ts (8 passed)
# - src/__tests__/productionOptimizationAndPwa.test.tsx (3 passed)
# - src/pages/__tests__/complianceAndResilience.test.tsx (5 passed)
# - src/auth/__tests__/authService.test.ts (5 passed)
# - src/db/__tests__/dispatchSecurity.db.test.ts (32 passed)
# - src/lib/__tests__/whatsapp.test.ts (8 passed)
# - src/types/__tests__/database.types.test.ts (1 passed)
# - src/services/__tests__/realtimeSync.test.ts (6 passed)

# 3. Oxlint Linter
npm run lint
# Result: PASSED (0 errors, 3 fast-refresh warnings)

# 4. Production Bundle Build
npm run build
# Result: PASSED (Vite production bundle built in 1.56s into dist/)
```

---

## 12. Prioritized Recommendations for Subsequent Phases

Based on this audit, the technical trajectory for the mobile transformation is prioritized as follows:

1. **Phase 2 (Design Bible & Screen Architecture):**
   - Establish mobile design tokens (48px touch targets, safe-area variables, mobile typography scale).
   - Specify role-based bottom navigation architecture:
     - **Merchant Tabs:** Deliveries (Home) | Create | Active Orders | Settings.
     - **Rider/Provider Tabs:** Jobs (Marketplace) | Active Delivery | History | Profile.
   - Define mobile interaction patterns: touchable cards, bottom-sheet drawers, and swipeable tabs.

2. **Phase 3 (Tokens & Reusable Mobile Foundation):**
   - Implement `MobileAppShell`, bottom tab navigation, safe-area-aware headers, and mobile bottom sheet modal.
   - Clean up CSS token usage and remove inline styles in favor of theme variables.

3. **Phase 4 (Merchant Application Redesign):**
   - Redesign `/vendor/dashboard` into a card-based mobile feed with status pill carousels and quick-action delivery cards.

4. **Phase 5 (Rider/Provider Application Redesign):**
   - Redesign `/logistics/dashboard` into a rider-focused operational interface: top availability pill bar, high-visibility targeted offer banners, one-tap accept/decline buttons, and bottom-sheet POD PIN & camera verification.

5. **Phase 6 (Delivery Creation & Tracking Refinement):**
   - Convert the 4-step wizard in `CreateDeliveryPage.tsx` into a lightweight, mobile-first wizard with sticky bottom navigation buttons and thumb-friendly provider selection cards.

6. **Phase 7 (Integration & Regression Testing):**
   - Verify end-to-end user flows on small viewports (360px–412px Android mobile standard).

7. **Phase 8 (Capacitor Configuration & Native Readiness):**
   - Install Capacitor CLI and platform libraries, configure `capacitor.config.ts`, handle Android hardware back button events, safe areas, and external WhatsApp intent links.

8. **Phase 9 (Final Quality Assurance):**
   - Final audit pass, production build verification, and release readiness sign-off.

---

## 13. Important Uncertainties & Known Limitations

1. **Absence of Pre-existing Capacitor Setup:**
   There are no Capacitor configuration files currently in the codebase. Capacitor will be introduced and configured during Phase 8.
2. **Provider Earnings Contract:**
   The database currently tracks estimated delivery prices (`estimated_price`) per delivery row; there is no separate aggregated ledger or payout table in PostgreSQL. The rider experience should display accumulated order values from completed jobs rather than inventing simulated financial balances.
3. **Android Studio & SDK Availability:**
   Native compilation of an `.apk` bundle depends on the user's host environment having the Android SDK installed. Phase 8 will configure the Capacitor Android project completely and provide exact CLI and Android Studio build instructions.

---
*Audit completed and recorded in `docs/mobile/ORDERFLOW_MOBILE_AUDIT.md`.*
