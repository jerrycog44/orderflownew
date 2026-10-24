# OrderFlow Mobile Design Bible & Screen Architecture

> **Document Version:** 1.0.0  
> **Target Release:** Mobile-First React SPA / Android Capacitor App  
> **Theme Foundations:** Navy (`#0F172A`), Logistics Blue (`#2563EB`), Slate Canvas (`#F8FAFC`)  
> **Typography:** Inter (400, 500, 600, 700)  
> **Touch Standard:** Minimum 48px × 48px Interactive Tap Targets  
> **Status:** Phase 2 Complete — Approved Specification  

---

## 1. Brand & Visual Philosophy

OrderFlow is a commercial B2B logistics infrastructure application. The mobile design language must convey **operational clarity, speed, reliability, and precision**. It is an operational tool used by busy retail merchants on crowded sales floors and dispatch riders navigating city traffic on motorcycles.

### 1.1 Guiding Principles
1. **Thumb-Zone First:** Primary navigation, action triggers, and delivery accepts/declines reside in the natural bottom thumb zone (lower 40% of the screen).
2. **Operational Glanceability:** Critical status information (Handover PIN, order status, pickup addresses, courier offers) must be immediately legible in bright outdoor daylight.
3. **No Decorative Distractions:** Every visual element serves a clear utility. Avoid decorative fluff, low-contrast text, or synthetic animations that slow down physical workflows.
4. **Hairline Precision:** Clean 1px borders (`#E2E8F0`), subtle elevation, and crisp 8px component radii establish an authoritative, enterprise-grade feel.

---

## 2. Foundational Mobile Design Tokens

### 2.1 Color Palette

```css
:root {
  /* Brand Core */
  --m-color-brand-primary: #0F172A;       /* Slate 900 - Deep Ink Navy (Headers, Primary Cards) */
  --m-color-brand-primary-light: #1E293B; /* Slate 800 - Active State / Elevated Card */
  --m-color-brand-accent: #2563EB;        /* Blue 600 - Primary Action, Links, Focus */
  --m-color-brand-accent-hover: #1D4ED8;  /* Blue 700 - Tap Active State */
  --m-color-brand-accent-subtle: #EFF6FF; /* Blue 50 - Active Tab / Selected Background */
  --m-color-brand-accent-border: #BFDBFE; /* Blue 200 - Selection Border */

  /* Neutral Canvas & Surfaces */
  --m-color-bg-app: #F8FAFC;              /* Slate 50 - Standard Mobile Canvas */
  --m-color-bg-surface: #FFFFFF;          /* Pure White - Card, Sheet & Input Surface */
  --m-color-bg-subtle: #F1F5F9;           /* Slate 100 - Secondary Wells, Inactive Pills */
  --m-color-bg-muted: #E2E8F0;            /* Slate 200 - Skeleton & Divider */

  /* Text & Hierarchy */
  --m-color-text-primary: #0F172A;        /* Slate 900 - Headings, Titles, Primary Values */
  --m-color-text-secondary: #475569;      /* Slate 600 - Subtitles, Body, Metadata */
  --m-color-text-muted: #64748B;          /* Slate 500 - Captions, Placeholders, Timestamps */
  --m-color-text-disabled: #94A3B8;       /* Slate 400 - Disabled Labels */
  --m-color-text-inverse: #FFFFFF;        /* White text for dark surfaces & primary buttons */

  /* Borders & Dividers */
  --m-color-border-default: #E2E8F0;      /* Slate 200 - Standard Card & Input Hairline */
  --m-color-border-subtle: #F1F5F9;       /* Slate 100 - Sub-divider */
  --m-color-border-strong: #CBD5E1;       /* Slate 300 - Active Focus & Selected Borders */

  /* Semantic Statuses (4-tier system: BG, Border, Text, Accent Dot) */
  --m-status-success-bg: #F0FDF4;         /* Green 50 */
  --m-status-success-border: #BBF7D0;     /* Green 200 */
  --m-status-success-text: #15803D;       /* Green 700 */
  --m-status-success-dot: #16A34A;        /* Green 600 - Delivered / Available */

  --m-status-warning-bg: #FFFBEB;         /* Amber 50 */
  --m-status-warning-border: #FDE68A;     /* Amber 200 */
  --m-status-warning-text: #B45309;       /* Amber 700 */
  --m-status-warning-dot: #D97706;        /* Amber 600 - Searching / Busy / Opportunity */

  --m-status-info-bg: #EFF6FF;            /* Blue 50 */
  --m-status-info-border: #BFDBFE;        /* Blue 200 */
  --m-status-info-text: #1D4ED8;          /* Blue 700 */
  --m-status-info-dot: #2563EB;           /* Blue 600 - In Transit / Matched */

  --m-status-error-bg: #FEF2F2;           /* Red 50 */
  --m-status-error-border: #FECACA;       /* Red 200 */
  --m-status-error-text: #B91C1C;         /* Red 700 */
  --m-status-error-dot: #DC2626;          /* Red 600 - Cancelled / Unavailable / Failed */
}
```

### 2.2 Typography Scale (Inter Font Family)

| Token | Size | Line Height | Weight | Mobile Usage |
|---|---|---|---|---|
| `--m-text-xs` | 11px (0.6875rem) | 14px | 500 / 600 | Overline badges, timestamp metadata, tab bar labels |
| `--m-text-sm` | 13px (0.8125rem) | 18px | 400 / 500 | Secondary descriptions, recipient addresses, input labels |
| `--m-text-base` | 15px (0.9375rem) | 22px | 400 / 500 | Primary card body, input values, button text |
| `--m-text-md` | 17px (1.0625rem) | 24px | 600 | Card titles, list headers, modal titles |
| `--m-text-lg` | 20px (1.25rem) | 26px | 700 | Screen headers, metric values |
| `--m-text-xl` | 24px (1.5rem) | 30px | 700 | Primary screen title, total amounts |
| `--m-text-pin` | 24px (1.5rem) | 28px | 800 | Monospace POD Handover Verification PIN |

### 2.3 Spacing, Touch Targets & Layout Geometry

```css
:root {
  /* Tap Target Guarantee */
  --m-touch-target-min: 48px;             /* Minimum interactive bounding box */

  /* 8pt Base Spacing Grid */
  --m-space-1: 4px;
  --m-space-2: 8px;
  --m-space-3: 12px;
  --m-space-4: 16px;                      /* Standard mobile screen gutter */
  --m-space-5: 20px;
  --m-space-6: 24px;
  --m-space-8: 32px;
  --m-space-10: 40px;

  /* Corner Radii */
  --m-radius-xs: 4px;                     /* Small badges */
  --m-radius-sm: 6px;                     /* Filter chips, small buttons */
  --m-radius-md: 8px;                     /* Form inputs, standard cards */
  --m-radius-lg: 12px;                    /* Featured cards, bottom sheet top corners */
  --m-radius-xl: 16px;                    /* Large container panels */
  --m-radius-full: 9999px;                /* Pills, avatar badges, FABs */

  /* Mobile Elevation */
  --m-shadow-card: 0 1px 3px rgba(15, 23, 42, 0.05);
  --m-shadow-elevated: 0 4px 12px rgba(15, 23, 42, 0.08);
  --m-shadow-sheet: 0 -4px 20px rgba(15, 23, 42, 0.12);
  --m-shadow-fab: 0 4px 14px rgba(37, 99, 235, 0.35);

  /* Safe Area Variables with Fallbacks */
  --m-safe-top: env(safe-area-inset-top, 0px);
  --m-safe-bottom: env(safe-area-inset-bottom, 0px);
  --m-safe-left: env(safe-area-inset-left, 0px);
  --m-safe-right: env(safe-area-inset-right, 0px);

  /* Navigation Heights */
  --m-header-height: 56px;
  --m-bottom-nav-height: 60px;
}
```

---

## 3. Core Component & Interaction Patterns

### 3.1 Mobile Header (`MobileHeader`)
- **Structure:**
  - **Left:** Contextual Back chevron (`ArrowLeft` 24px) on nested routes, OR compact OrderFlow icon mark on root tabs.
  - **Center:** Bold Screen Title (e.g. *"Deliveries"*, *"Active Job"*, *"Settings"*) + subtle Workspace Badge (*"Vendor"* or *"Courier"*).
  - **Right:** Contextual secondary action (e.g. Refresh trigger, filter toggle, or notification bell).
- **Behavior:** Fixed/sticky at top with `backdrop-filter: blur(8px)`, padded by `--m-safe-top`.

### 3.2 Mobile Bottom Navigation Bar (`MobileBottomNav`)
- **Structure:** 4 high-priority destinations strictly tailored to the user's role.
- **Merchant Tabs:**
  1. `Orders` (Home icon) → Active & historical deliveries list.
  2. `Create` (Plus-circle accent icon) → Multi-step delivery creation wizard.
  3. `Track` (Search icon) → Quick tracking lookup.
  4. `Profile` (User icon) → Workspace settings, company profile & switcher.
- **Rider / Provider Tabs:**
  1. `Marketplace` (Briefcase / Compass icon) → Targeted offers & open broadcast jobs.
  2. `Active` (Truck icon) → Assigned job workflow, directions, and handover POD.
  3. `Earnings` (Wallet / Banknote icon) → Completed order receipts & revenue history.
  4. `Profile` (Settings / User icon) → Fleet details, service cities, and availability.
- **Behavior:** Fixed at bottom, padded by `--m-safe-bottom`. Active tab receives Blue 600 tint with subtle icon pop; inactive tabs rendered in Slate 500.

### 3.3 Delivery Job Card (`DeliveryJobCard`)
The universal data card displayed across Merchant and Provider feeds:
- **Top Row:** Tracking Code (monospace font) + Semantic Status Badge (e.g. `In Transit`, `Awaiting Pickup`).
- **Middle Section:**
  - Product Name (bold) + Weight/Quantity pill.
  - Vertical Route Connector:
    - 🟢 Green dot → Pickup City / Neighborhood.
    - 🔴 Red pin → Destination City / Neighborhood.
- **Bottom Row:**
  - Estimated Price (`₦X,XXX`) in bold Slate 900.
  - Assigned Provider Name OR *"Matching..."* indicator.
  - Tap indicator chevron (`ChevronRight`).
- **Touch Target:** Entire card surface is clickable with subtle `active` press animation (`transform: scale(0.99)`).

### 3.4 Bottom Sheet Drawer (`BottomSheet`)
Replaces desktop-centered modals for mobile workflows:
- **Trigger:** Handover PIN verification, courier details inspection, filter drawer, and profile editing.
- **Appearance:** Slides up from bottom with `--m-radius-lg` (16px) top rounded corners.
- **Header:** Centered gray pill grab handle (`36px × 4px`), bold title, and right-hand `X` dismiss button.
- **Body:** Scrollable content area with automatic scroll-to-bottom padding for `--m-safe-bottom`.
- **Dismissal:** Tap on backdrop scrim, tap `X`, or press Android native back button.

### 3.5 Floating Action Button (FAB) & Sticky Action Bar
- **Merchant Home:** Sticky/Floating "New Delivery" button with `+` icon positioned 16px above the bottom tab navigation bar.
- **Wizard Steps:** Sticky Bottom Bar containing full-width primary button (*"Continue to Location"*, *"Confirm Delivery"*), pinned immediately above `--m-safe-bottom` so users never scroll to proceed.

---

## 4. Merchant (Vendor) Screen Architecture

```
[Merchant Shell: AppHeader + Viewport Container + BottomNav]
  ├── Tab 1: Orders (Home)
  │     ├── Metrics Snapshot (Active, In Transit, Delivered)
  │     ├── Status Pill Filter Carousel (All, Searching, In Transit, Delivered)
  │     └── Delivery Card Feed (Infinite scroll list with pull-to-refresh)
  ├── Tab 2: Create Delivery Wizard
  │     ├── Step 1: Package Specifications (Name, category, package type, weight, fragile)
  │     ├── Step 2: Pickup & Dropoff Routing (Sender contact, recipient name/phone, cities)
  │     ├── Step 3: Review & Summary (Price estimate, route verification)
  │     └── Step 4: Dispatch Mode Selection (Smart Auto-Dispatch vs Manual Carrier Selection)
  ├── Tab 3: Track Package
  │     ├── Tracking Search Input with QR / Code paste
  │     └── Milestone Status Progression Timeline (Created → Matched → In Transit → Delivered)
  ├── Tab 4: Profile & Settings
  │     ├── Merchant Business Profile (Name, Category, Operating City)
  │     ├── Workspace Switcher (Switch to Logistics Provider mode)
  │     └── Session Sign Out
  └── Sub-Route: Delivery Detail View (`/vendor/deliveries/:id`)
        ├── Tracking Code & WhatsApp Share Trigger
        ├── Handover Verification PIN Card (High contrast 4-digit PIN)
        ├── Interactive Delivery Timeline
        └── Recipient & Courier Contact Details
```

### 4.1 Merchant Screen Specifications

#### Screen M-1: Merchant Home / Orders (`/vendor/dashboard`)
- **Header:** OrderFlow logo mark, "Vendor Workspace" badge, Profile avatar button.
- **KPI Summary Row:** Horizontal scrollable metric tiles:
  - *Active Dispatches* (count)
  - *In Transit* (count)
  - *Delivered Today* (count)
- **Search & Filter Carousel:**
  - Sticky search bar with clear button (`X`).
  - Horizontal pill selector: `All`, `Searching`, `In Transit`, `Delivered`, `Exceptions`.
- **Feed:** List of `DeliveryJobCard`s. Tapping navigates to `/vendor/deliveries/:id`.
- **Empty State:** High-contrast illustration, "No deliveries yet", and prominent "Create Your First Delivery" button.
- **Primary Action:** Floating Action Button (FAB) *"New Delivery"* (+ icon).

#### Screen M-2: Create Delivery Wizard (`/vendor/deliveries/create`)
- **Progress Indicator:** Compact 4-dot milestone stepper at top of viewport.
- **Step 1 (Package):**
  - Item name (required).
  - Category dropdown (Fashion, Electronics, Groceries, Documents, Other).
  - Package format selector: large tap cards (`Parcel`, `Box`, `Bag`, `Fragile`).
  - Weight in KG (stepper with `-` and `+` touch controls or direct numeric input).
- **Step 2 (Locations & Recipient):**
  - Pickup city & address with sender phone.
  - Destination city & address.
  - Recipient full name & Nigerian phone number (`080...` or `+234...`).
  - Special delivery notes.
- **Step 3 (Review):**
  - Estimated delivery cost based on distance/weight.
  - Summary card of route and package.
- **Step 4 (Dispatch Mode Selection):**
  - **Option A (Recommended):** *Smart Dispatch* — automatically evaluates candidates, dispatches to top-ranked carrier, falls back to open marketplace.
  - **Option B:** *Manual Selection* — displays candidate cards with fleet ratings, vehicle types, and estimated transit times.
- **Confirmation State:**
  - Celebratory checkmark header.
  - Prominent 4-digit Handover PIN for courier handover.
  - Green *"Share via WhatsApp"* button opening pre-formatted tracking link.

#### Screen M-3: Delivery Detail (`/vendor/deliveries/:id`)
- **Header:** Back button, Tracking Code title, Status pill.
- **Handover PIN Box:** Displayed in a high-visibility green-tinted card (`letter-spacing: 4px`, monospace, 24px font size).
- **Customer WhatsApp Action:** One-tap action generating `wa.me` message with live tracking link.
- **Carrier Card:** Assigned courier name, vehicle type, rating, and call button (if accepted).
- **Status Timeline:** Vertical milestone tracker showing:
  - *Order Created* → *Provider Assigned* → *Package Picked Up* → *In Transit* → *Delivered*.

---

## 5. Rider / Provider Screen Architecture

```
[Provider Shell: AppHeader + Viewport Container + BottomNav]
  ├── Tab 1: Marketplace (Jobs Feed)
  │     ├── Availability Toggle Bar (Available | Busy | Offline)
  │     ├── Targeted Dispatch Offer Hero (Countdown banner with 1-tap Accept/Decline)
  │     └── Open Marketplace Job Cards (Redacted PII, distance, package category, price)
  ├── Tab 2: Active Delivery
  │     ├── Current In-Progress Job Card
  │     ├── Quick Actions: Navigation (Google Maps Intent) & Call Customer
  │     ├── Status Transition Action Bar (Mark Picked Up / Start Transit)
  │     └── Handover Completion Drawer (PIN Entry + Photo Proof Upload)
  ├── Tab 3: Completed & Receipts
  │     ├── Aggregate Value Completed Deliveries
  │     └── Historical Delivery Log with Completed Timestamps
  ├── Tab 4: Fleet Profile & Settings
  │     ├── Provider Name, Fleet Type, Vehicle Types
  │     ├── Operating Cities & Coverage Area
  │     ├── Workspace Switcher (Switch to Vendor mode)
  │     └── Sign Out
```

### 5.1 Rider Screen Specifications

#### Screen R-1: Rider Marketplace & Availability (`/logistics/dashboard`)
- **Availability Toggle Bar:**
  Full-width segmented pill bar pinned at the top:
  - 🟢 **Available:** Ready to receive instant dispatch opportunities.
  - 🟠 **Busy:** On delivery; temporarily skipped by automated candidate queues.
  - ⚪ **Offline:** Off-duty; offers not received.
- **Targeted Offer Hero Card (Priority Notification):**
  When a targeted opportunity arrives:
  - Audio chime chimes + card flashes subtle blue border.
  - Displays: Package category, weight, pickup neighborhood → dropoff neighborhood (exact street hidden for privacy).
  - Payout price: `₦X,XXX` in large bold text.
  - Action buttons:
    - ❌ **Decline** (ghost button, frees job for next candidate in queue).
    - ✅ **Accept Job** (solid Green button, executes atomic `accept_delivery_opportunity` lock).
- **Open Broadcast Opportunities:**
  Cards for unclaimed orders across the carrier's coverage area.

#### Screen R-2: Active Delivery Workflow
- When a job is accepted, the screen transitions to active execution mode:
  1. **Phase 1: Proceed to Pickup**
     - Full pickup address and contact phone revealed.
     - Action button: *"Confirm Package Picked Up"* (moves status to `in_transit`).
  2. **Phase 2: In Transit to Customer**
     - Recipient name, phone number, and street address revealed.
     - Action buttons: *"Call Recipient"* (`tel:...`) and *"Open Maps"*.
  3. **Phase 3: Package Handover & Proof of Delivery (POD)**
     - Button: *"Complete Delivery (Enter PIN)"*.
     - Opens `BottomSheet`:
       - 4-digit PIN input matching vendor's code.
       - Courier photo proof capture button (if vendor required photo proof).
       - Solid Submit button verifying credentials and closing delivery.

#### Screen R-3: Completed Orders & Earnings
- Displays total order values delivered today / this week based on genuine completed deliveries (`status = 'delivered'`).
- Chronological list of completed trips with verified delivery timestamps.

---

## 6. Screen State Architecture (Universal Matrix)

Every mobile screen must explicitly implement 5 standard operational states:

| State | Visual Treatment | User Guidance / Actions |
|---|---|---|
| **1. Loading** | Skeleton layout matching target card shapes (shimmer `#F1F5F9` → `#E2E8F0`). | Prevents layout shift; disables tap actions during fetch. |
| **2. Empty** | Centered Lucide icon in subtle circle + bold header + 1-sentence guidance. | Clear Call-to-Action button (e.g. *"Create Delivery"* or *"Set Status to Online"*). |
| **3. Active / Success** | High-contrast data cards, clear typography, and active status badges. | Primary thumb-zone buttons enabled with tap ripple/scale effect. |
| **4. Offline / Cached** | Yellow/amber banner at top: *"Operating in offline cache. Changes will sync when reconnected."* | Cached deliveries remain browseable from local storage. |
| **5. Error / Exception** | Red alert banner with explicit error text and *"Retry"* button. | Non-blocking inline alert that does not crash the viewport. |

---

## 7. Mobile Safe-Area & Viewport Handling

### 7.1 Viewport Configuration
The HTML viewport tag in `index.html` is configured for native mobile webview compliance:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

### 7.2 Safe Area Rules
- **Header:** `padding-top: max(var(--m-space-3), var(--m-safe-top));`
- **Bottom Navigation:** `padding-bottom: max(var(--m-space-2), var(--m-safe-bottom)); height: calc(var(--m-bottom-nav-height) + var(--m-safe-bottom));`
- **Bottom Action Buttons:** Positioned above the bottom navigation bar or bottom sheet drawer with safe inset margin.
- **Scroll Containers:** Body container must have `padding-bottom: calc(var(--m-bottom-nav-height) + var(--m-safe-bottom) + 16px)` to prevent content from being hidden behind bottom navigation.

---

## 8. Motion, Feedback & Accessibility Standards

### 8.1 Transitions
- **Page Transitions:** Instant mount with fade-in (`150ms ease-out`).
- **Sheet Drawers:** Slide up from bottom (`220ms cubic-bezier(0.16, 1, 0.3, 1)`).
- **Button Press:** Active scale transform (`transform: scale(0.98)` with `100ms` duration).

### 8.2 Touch Target Compliance
- All buttons, chips, tabs, and actionable icons enforce a minimum bounding box of **`48px × 48px`**.
- Form input fields enforce a minimum height of **`48px`** with font size at least **`16px`** to prevent unwanted iOS Safari / Android WebView auto-zooming on focus.

### 8.3 Contrast Standards
- Primary text on surface: Contrast ratio **`12.6:1`** (passes WCAG AAA).
- Secondary metadata on canvas: Contrast ratio **`4.8:1`** (passes WCAG AA).
- Action buttons: Pure white text on Blue 600 (`#2563EB`): Contrast ratio **`4.6:1`** (passes WCAG AA).

---

## 9. Capacitor Native Platform Considerations

1. **Android Hardware Back Button:**
   - Navigates backward in React Router stack.
   - If a `BottomSheet` or `Modal` is open, hardware back dismisses the sheet instead of exiting the screen.
   - If on the root dashboard tab, back prompts a confirm-exit toast.
2. **Keyboard Handling:**
   - Virtual keyboard must not resize or distort the bottom tab navigation.
   - Form containers must automatically scroll active inputs into view.
3. **Intent Links:**
   - WhatsApp direct links (`https://wa.me/...`) must open directly inside the native Android WhatsApp application via Android Intents.
   - Recipient telephone links (`tel:...`) must invoke the native Android dialer.

---

*OrderFlow Mobile Design Bible specification complete and established.*
