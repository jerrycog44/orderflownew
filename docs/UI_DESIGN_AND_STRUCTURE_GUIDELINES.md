# OrderFlow UI Design & Structure Guidelines
**Version:** 1.0.0  
**Target:** OrderFlow Web Application  
**Aesthetic Profile:** Restrained, High-Precision Logistics for African Commerce  
**Tech Stack:** React 19, TypeScript, Vanilla CSS Design Tokens, Lucide Icons, Vite  

---

## 1. Executive Summary & Design Philosophy

OrderFlow is a business-critical logistics orchestration platform serving commercial merchants, logistics providers, and end consumers across Nigeria and West Africa. 

### 1.1 Core Design Pillars

1. **Enterprise Precision & Restraint**: Avoid loud, playful, or cluttered consumer app tropes. OrderFlow uses a crisp, high-contrast, slate-and-navy aesthetic with purposeful logistics blue accents. Every element on screen must serve operational clarity.
2. **Instant Status Comprehension (Glanceability)**: Dispatchers, vendors, and couriers make split-second decisions. Key identifiers (tracking codes, status badges, payment methods, destination hubs) must be visually prominent, consistently positioned, and color-coded.
3. **Localized Context as a First-Class Citizen**: OrderFlow is built for Nigerian commercial hubs (Lagos, Ibadan, Abuja, Port Harcourt, Kano). All currency displays (Naira `₦`), phone formats (`0803 123 4567`), address formats, and Cash on Delivery (COD) workflows must reflect realistic local commerce.
4. **Resilience & Graceful Degradation**: Whether offline, experiencing flaky mobile connectivity, or loading large data sets, the UI must provide explicit feedback: skeleton loaders, spinner states, retry banners, and unambiguous error messaging.
5. **Architectural Separation of Shells**: Public marketing, authentication/onboarding, and authenticated operational workspaces are distinct shells with strict navigational boundaries.

---

## 2. Design Tokens & Styling Architecture

OrderFlow uses Vanilla CSS variables defined in [src/styles/theme.css](file:///c:/orderflownew/src/styles/theme.css) and reset/utilities in [src/styles/global.css](file:///c:/orderflownew/src/styles/global.css).

> [!IMPORTANT]
> **Strict Variable Rule**: Never use hardcoded hex values or arbitrary CSS variables in layout code. Always use the canonical design tokens below.

### 2.1 Color Tokens & Semantic Usage

| Token Category | Variable Name | Hex Value | Semantic Purpose / Rules |
| :--- | :--- | :--- | :--- |
| **Brand Primary** | `var(--color-brand-primary)` | `#0F172A` (Slate 900) | Primary buttons, headers, high-contrast text, brand elements |
| **Brand Primary Hover**| `var(--color-brand-primary-hover)`| `#1E293B` (Slate 800) | Hover state for primary buttons |
| **Brand Accent** | `var(--color-brand-accent)` | `#2563EB` (Blue 600) | Active links, primary icons, focus rings, selected cards |
| **Brand Accent Hover**| `var(--color-brand-accent-hover)` | `#1D4ED8` (Blue 700) | Hover state for interactive logistics accents |
| **Brand Accent Light**| `var(--color-brand-accent-light)` | `#F0F6FF` (Blue 50) | Selected item background, subtle hero highlights |
| **Accent Border** | `var(--color-brand-accent-border)`| `#DBEAFE` (Blue 100) | Selected borders, subtle pill badges |
| **App Canvas** | `var(--color-bg-app)` | `#F8FAFC` (Slate 50) | Neutral background for all application and workspace canvases |
| **Surface** | `var(--color-bg-surface)` | `#FFFFFF` | Cards, modals, dropdown menus, table panels |
| **Subtle Background** | `var(--color-bg-subtle)` | `#F1F5F9` (Slate 100) | Secondary containers, table header bars, input hover |
| **Muted Background** | `var(--color-bg-muted)` | `#E2E8F0` (Slate 200) | Skeleton loaders, disabled pills |
| **Primary Text** | `var(--color-text-primary)` | `#0F172A` (Slate 900) | Headings, card titles, key values, active navigation |
| **Secondary Text** | `var(--color-text-secondary)` | `#475569` (Slate 600) | Body copy, descriptions, secondary metadata |
| **Muted Text** | `var(--color-text-muted)` | `#64748B` (Slate 500) | Timestamps, helper text, inactive labels (WCAG AA compliant) |
| **Disabled Text** | `var(--color-text-disabled)` | `#94A3B8` (Slate 400) | Disabled buttons, inactive input placeholders |
| **Border Default** | `var(--color-border-default)` | `#E2E8F0` (Slate 200) | Standard card, table, and divider borders |
| **Border Subtle** | `var(--color-border-subtle)` | `#F1F5F9` (Slate 100) | Inner card dividers, subtle row separators |
| **Border Strong** | `var(--color-border-strong)` | `#CBD5E1` (Slate 300) | Input hover, card hover, active modal borders |

### 2.2 Status & Feedback Tokens

Status colors must never be chosen randomly. Every delivery, order, or transaction state maps to an explicit status palette:

```
+---------------------------------------------------------------------------------------+
| STATUS TOKEN MAPPINGS                                                                 |
+---------------------------------------------------------------------------------------+
| Success (Delivered, Paid, Verified, Active):                                          |
|   bg: var(--color-status-success-bg)     #F0FDF4 (Green 50)                           |
|   text: var(--color-status-success-text) #15803D (Green 700)                          |
|   border: var(--color-status-success-border) #DCFCE7 (Green 100)                      |
|                                                                                       |
| Warning (Awaiting Pickup, Opportunity Pending, Unpaid COD):                           |
|   bg: var(--color-status-warning-bg)     #FFFBEB (Amber 50)                           |
|   text: var(--color-status-warning-text) #B45309 (Amber 700)                          |
|   border: var(--color-status-warning-border) #FEF3C7 (Amber 100)                      |
|                                                                                       |
| Info / In Progress (Searching Couriers, Provider Matched, In Transit):                |
|   bg: var(--color-status-info-bg)        #EFF6FF (Blue 50)                            |
|   text: var(--color-status-info-text)    #1D4ED8 (Blue 700)                           |
|   border: var(--color-status-info-border)#DBEAFE (Blue 100)                           |
|                                                                                       |
| Error / Destructive (Cancelled, Failed Delivery, Connection Error):                   |
|   bg: var(--color-status-error-bg)       #FEF2F2 (Red 50)                             |
|   text: var(--color-status-error-text)   #B91C1C (Red 700)                            |
|   border: var(--color-status-error-border) #FEE2E2 (Red 100)                          |
+---------------------------------------------------------------------------------------+
```

### 2.3 Typography Scale

Strictly enforce the `Inter` font family and standard hierarchical weights:
* `400` (`--font-weight-normal`): Body paragraphs, long text, table cells.
* `500` (`--font-weight-medium`): Form labels, navigation links, secondary metadata.
* `600` (`--font-weight-semibold`): Buttons, card titles, section headers, badge labels.
* `700` (`--font-weight-bold`): Page titles (`h1`), modal titles, primary KPI numbers.

```css
/* Typography Scale */
--font-size-xs: 0.75rem;    /* 12px - Badges, micro metadata */
--font-size-sm: 0.875rem;   /* 14px - Body default, table cells, form inputs */
--font-size-base: 1rem;     /* 16px - Emphasized body, card descriptions */
--font-size-lg: 1.125rem;   /* 18px - Card titles, subheadings */
--font-size-xl: 1.25rem;    /* 20px - Panel headers, modal titles */
--font-size-2xl: 1.5rem;    /* 24px - Section headers, sub-dashboards */
--font-size-3xl: 1.875rem;  /* 30px - Major feature headings */
--font-size-4xl: 2.25rem;   /* 36px - Hero headings, page h1s */
```

### 2.4 Spacing & Elevation

* **Grid Base**: 4px base increment (`4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `40px`, `48px`, `64px`).
* **Border Radii**:
  * `var(--radius-sm)` (6px): Badges, small action icons, status pills.
  * `var(--radius-md)` (8px): Inputs, buttons, form controls, metric cards.
  * `var(--radius-lg)` (12px): Main cards, panels, list row containers.
  * `var(--radius-xl)` (16px): Dialogs, modals, floating action containers.
  * `var(--radius-full)` (9999px): Avatar circles, radio pills, progress bars.
* **Shadows (Soft Elevation)**: Never use heavy black shadows. Use tinted slate shadows:
  * `--shadow-sm`: `0 1px 2px 0 rgba(15, 23, 42, 0.04)` (Card resting)
  * `--shadow-md`: `0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.03)` (Hover state)
  * `--shadow-overlay`: `0 20px 32px -8px rgba(15, 23, 42, 0.16)` (Modals & dropdowns)

---

## 3. Application Shell & Layout Architecture

OrderFlow divides its user experience into **Three Strict Layout Shells**. An authenticated user must never see marketing chrome, and an unauthenticated user must never be trapped in a workspace shell.

```
                                  [ OrderFlow Root ]
                                           |
         +---------------------------------+---------------------------------+
         |                                 |                                 |
[ 1. Public Marketing Shell ]     [ 2. Auth & Onboard Shell ]      [ 3. Workspace Shell ]
  (PublicLayout)                    (AuthLayout)                     (AppLayout)
  - Public Navbar                   - Focused Centered Card          - Sticky App Header
  - Hero, Features, Trust           - Minimal Header Logo            - Workspace Switcher
  - Public Order Tracker            - Clean Form Controls            - Avatar Dropdown Menu
  - Comprehensive Footer            - No distracting links           - No Marketing Footer
  - Terms & Privacy pages           - Step-by-step progress          - Fast Operational Canvas
```

### 3.1 The Public Marketing Shell (`PublicLayout.tsx`)
* **Components**: `Navbar.tsx` + `<Outlet />` + `Footer.tsx`.
* **Behavior**:
  * Navbar remains sticky with background blur on scroll (`rgba(255, 255, 255, 0.96); backdrop-filter: blur(8px)`).
  * Direct action buttons to login, signup as vendor, or signup as logistics provider.
  * Footer includes complete legal links, contact information, and operating city tags.

### 3.2 The Auth & Onboarding Shell (`AuthLayout.tsx`)
* **Usage**: `/login`, `/signup`, `/forgot-password`, `/role-selection`, `/onboarding/vendor`, `/onboarding/provider`.
* **Behavior**:
  * Maximum width container: `480px` for auth forms, `560px` for role selection & onboarding.
  * No marketing navbar; displays centered OrderFlow logo + workspace tag.
  * Displays single primary CTA per step with keyboard navigation (`Enter` triggers next step).

### 3.3 The Authenticated Workspace Shell (`AppLayout.tsx`)
* **Usage**: `/vendor/dashboard`, `/vendor/deliveries/*`, `/logistics/dashboard`.
* **Mandatory Rules**:
  1. **Sticky Header Layering**: Must have an opaque background and solid bottom border:
     ```css
     background-color: rgba(255, 255, 255, 0.96);
     backdrop-filter: blur(8px);
     -webkit-backdrop-filter: blur(8px);
     border-bottom: 1px solid var(--color-border-default);
     position: sticky;
     top: 0;
     z-index: 100;
     ```
  2. **No Marketing Footer**: Workspaces must never render marketing footers. Screen real estate is reserved for operational data tables, maps, and order queues.
  3. **Workspace Switcher & Profile Dropdown**: User avatar in the top right anchors the dropdown containing:
     * User name, email, and role badge.
     * Workspace Settings modal trigger (edit business name, city, phone).
     * Role switch action (instant toggle between Vendor and Logistics Provider views).
     * Global Sign Out action.
  4. **No Duplicate Page-Level Header Buttons**: Avoid repeating "Sign out" or role badges inside page `<h1>` areas when they are already present in the top app bar.

---

## 4. Information Architecture & Page Hierarchy

### 4.1 The "Single Primary Action" Principle

> [!WARNING]
> **Anti-Pattern**: Having multiple solid black/navy primary buttons on the same screen confuses the operator.

* **Rule**: Each view has **one and only one** primary action button:
  * On the Vendor Dashboard: `+ Create Delivery` in the page header is the primary action. List toolbars, filters, and row actions must use `variant="outline"` or `variant="ghost"`.
  * Exception: When a list is completely empty, an empty state primary CTA (`Create First Delivery`) is required.
  * On the Provider Dashboard: The primary action on an opportunity card is `View & Accept Job`. Secondary actions (call vendor, view details) must be outline.

### 4.2 Standard Dashboard Page Formula

Every authenticated dashboard must conform to this structured vertical stacking:

```
+-------------------------------------------------------------------------------------+
| 1. Page Header: Title (h1) + Subtitle + Primary Page CTA (e.g., + Create Delivery)  |
+-------------------------------------------------------------------------------------+
| 2. Error / Resilience Banner (Conditional: Renders on network/database failure)     |
+-------------------------------------------------------------------------------------+
| 3. Metrics Summary Grid: 4-Column KPI Cards (Total, Pending, In Transit, Delivered) |
+-------------------------------------------------------------------------------------+
| 4. Main Operational Panel:                                                          |
|    a. Panel Header: Title + Subtitle                                                |
|    b. Filter & Search Bar: Text Input + Title-Cased Status Pills (All, In Progress) |
|    c. Data List / Table / Card Queue (with hover states, icons, and status badges)  |
|    d. Pagination or Real-time Status Indicator                                      |
+-------------------------------------------------------------------------------------+
```

### 4.3 KPI Metrics Grid Pattern

All dashboards must feature a 4-card metric overview displaying operational velocity:

```tsx
<div className="of-metrics-grid">
  <div className="of-metric-card">
    <div className="of-metric-header">
      <span className="of-metric-label">In Transit</span>
      <Truck size={18} color="var(--color-brand-accent)" />
    </div>
    <p className="of-metric-value">{inTransitCount}</p>
    <span className="of-metric-subtext">Active on road</span>
  </div>
</div>
```

---

## 5. Component Design Standards & Primitives

All UI components live in `src/components/ui/` and must follow these implementation standards.

### 5.1 Buttons (`Button.tsx`, `Button.css`)
* **Variants**:
  * `primary`: Solid Dark Ink Navy (`#0F172A`). Used for the main page or modal CTA.
  * `secondary`: Solid Logistics Blue (`#2563EB`). Used for high-emphasis accent actions (e.g. WhatsApp Share).
  * `outline`: White surface with border (`#E2E8F0`). Standard for secondary actions, filters, table row actions.
  * `ghost`: Transparent with hover highlight. Used for icon buttons, cancel actions, header navigation.
  * `destructive`: Solid Red (`#DC2626`). Used only for delete, cancel dispatch, or reject order.
* **Sizes**:
  * `sm`: 36px height, 13px text (list actions, inline filters).
  * `md`: 42px height, 14px text (standard form buttons, header actions).
  * `lg`: 48px height, 15px text (wizard step progression, auth submit).
* **Loading States**: When `isLoading={true}`, disable the button, show the CSS spinner, and maintain the button's layout dimensions (no layout shift).

### 5.2 Cards & Panels (`Card.tsx`, `Card.css`)
* Cards use `var(--color-bg-surface)` with a 1px `var(--color-border-default)` border and `var(--radius-lg)` (12px).
* Hoverable cards (`hoverable={true}`) must have subtle elevation:
  ```css
  .of-card-hoverable:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--color-border-strong);
    transform: translateY(-2px);
  }
  ```

### 5.3 Form Controls (`Input.tsx`, `Select.tsx`, `Textarea.tsx`, `Form.css`)
* **Standard Height**: 42px for inputs and selects.
* **Labeling**: Labels are always above the input (`font-size: 13px`, `font-weight: 500`). Required fields append a red asterisk (`*`).
* **Icon Slots**: Provide `leftIcon` (e.g. search, phone, map pin) and `rightIcon` (e.g. clear, toggle visibility).
* **Focus State**: Never remove focus rings without replacing them:
  ```css
  .of-input:focus {
    outline: none;
    border-color: var(--color-brand-accent);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }
  ```
* **Error States**: Display error message below input in red (`#DC2626`), with `aria-invalid="true"`.

### 5.4 Badges & Status Indicators (`Badge.tsx`, `Badge.css`)
* Status badges must always use Title Case (`In Transit`, `Delivered`, `Awaiting Pickup`).
* Always use `DeliveryStatusBadge` for rendering package or dispatch statuses to guarantee consistent color-coding across Vendor, Provider, and Customer views.

### 5.5 Modals & Dialogs (`Modal.tsx`, `Modal.css`)
* Modals must have an explicit backdrop blur: `backdrop-filter: blur(2px); background-color: rgba(15, 23, 42, 0.6);`.
* Body must scroll independently when content exceeds viewport (`max-height: 90vh; overflow-y: auto;`).
* Modal footer must keep CTAs right-aligned: Secondary/Cancel on the left, Primary confirmation on the right.
* Must support closing on `Escape` key and outside backdrop click.

---

## 6. Multi-Step Wizard Architecture (Create Delivery)

The delivery creation wizard in [CreateDeliveryPage.tsx](file:///c:/orderflownew/src/pages/CreateDeliveryPage.tsx) is the highest-volume workflow in OrderFlow.

```
[ Step 1: Package Specs ] -> [ Step 2: Pickup & Dropoff ] -> [ Step 3: Review & Dispatch ] -> [ Step 4: Confirmation & WhatsApp ]
```

### 6.1 Step Rules
1. **Above-the-Fold Prioritization**:
   * Keep optional dropzones or secondary image previews compact (maximum 54px height) so required fields (dimensions, weight, fragile toggle) remain visible on standard laptops (768px height) without scrolling.
2. **Predictive Defaults**:
   * Pre-fill vendor pickup location based on their saved workspace profile.
   * Default package type to standard commercial parcel (`1.5 kg`, `30x20x12 cm`).
3. **Step Navigation Guard**:
   * Users can only jump to steps they have already unlocked or completed.
   * Wizard must validate the current step before advancing.
4. **Instant Customer Sharing (Step 4)**:
   * Provide a prominent, brand-colored WhatsApp button (`#25D366`) that opens `https://wa.me/` with a pre-formatted message containing:
     * Customer name and item description.
     * Direct tracking URL (`/track/:trackingCode`).
     * Handover PIN (POD code).
     * Estimated delivery arrival.

---

## 7. Customer Tracking Experience & Proof of Delivery (POD)

The public tracking page ([CustomerTrackingPage.tsx](file:///c:/orderflownew/src/pages/CustomerTrackingPage.tsx)) is the only screen seen by end buyers. It requires maximum trust and security clarity.

### 7.1 Visual Timeline Milestones
* Never use raw numeric circles (`1`, `2`, `3`, `4`, `5`).
* Always use semantic Lucide icons for each milestone:
  * Order Created: `Package`
  * Dispatching / Matching: `Clock` (or animated pulse)
  * Provider Matched: `ShieldCheck`
  * In Transit: `Truck`
  * Delivered: `CheckCircle2`
* Color progression:
  * Completed steps: Emerald Green (`#10B981`) with checkmark.
  * Current active step: Solid Blue Accent (`#2563EB`) with subtle pulse.
  * Future steps: Neutral Muted Slate (`#94A3B8`).

### 7.2 Handover PIN & Proof of Delivery Security
* Show the 4-digit Handover PIN inside a high-visibility security box with monospace lettering and letter spacing:
  ```tsx
  <div className="of-pod-box">
    <span className="of-pod-label">Your Handover PIN</span>
    <span className="of-pod-pin">{podCode}</span>
    <p className="of-pod-hint">Give this 4-digit code to the dispatch rider upon receiving your package.</p>
  </div>
  ```

### 7.3 Cash on Delivery (COD) Payment Guidance
* If `paymentMethod === 'cash_on_delivery'`:
  * Render an Amber alert card displaying the exact amount: `₦{estimatedPrice.toLocaleString()}`.
  * Instruction: *"Please have exact cash or direct bank transfer ready for the dispatch rider upon arrival."*
* If `paymentMethod === 'prepaid_online'`:
  * Render an Emerald verified card: `✓ Prepaid Online — No payment required on delivery`.

---

## 8. Localization & Regional Standards (Nigeria & West Africa)

Every developer and designer working on OrderFlow must adhere to these geographic rules:

### 8.1 Currency Representation
* Always prefix currency with the Naira sign: `₦`.
* Always comma-format numbers: `₦3,500`, `₦14,200`. Never write `3500 NGN`, `N3500`, or `$35`.

### 8.2 City Hubs & Geographic Hierarchy
* Form placeholders must use realistic operating cities and districts:
  * Lagos: `Ikeja`, `Victoria Island`, `Lekki Phase 1`, `Yaba`, `Surulere`.
  * Oyo: `Bodija, Ibadan`, `Dugbe, Ibadan`, `Ring Road, Ibadan`.
  * FCT: `Central Business District, Abuja`, `Maitama`, `Wuse 2`, `Garki`.
  * Rivers: `Port Harcourt`, `GRA Phase 2`.
* Never use generic foreign placeholders (`San Francisco`, `New York`, `123 Main St`).

### 8.3 Phone Numbers
* Format: `0803 123 4567` or `+234 803 123 4567`.

---

## 9. Accessibility & Usability (WCAG AA Compliance)

1. **Color Contrast**:
   * All body and metadata text must satisfy minimum 4.5:1 contrast against its background.
   * Inactive step labels and helper text must use `var(--color-text-secondary)` (`#475569`) or `var(--color-text-muted)` (`#64748B`), never pale grays (`#CBD5E1` or `#E2E8F0` on white).
2. **Touch Targets**:
   * All interactive elements (buttons, filter pills, dropdown triggers, table rows) must have a minimum touch target of `44px x 44px` on mobile viewports.
3. **Keyboard Operability**:
   * Every modal must trap focus and close on `Escape`.
   * Every custom radio or pill group must support arrow key or `Space`/`Enter` selection.
   * Interactive elements must feature `:focus-visible` styling (`outline: 2px solid var(--color-brand-accent); outline-offset: 2px`).
4. **Horizontal Overflow Prohibition**:
   * Workspaces must never exhibit horizontal scrolling on standard mobile widths (375px, 390px, 414px). Badges, headers, and table rows must collapse or wrap gracefully.

---

## 10. Code Standards & CSS Hygiene

### 10.1 Class Naming Convention
* Use semantic BEM-inspired naming with the `.of-` prefix:
  * Component root: `.of-card`, `.of-modal`, `.of-btn`
  * Sub-elements: `.of-card-header`, `.of-btn-content`
  * State modifiers: `.is-active`, `.is-selected`, `.is-open`, `.is-loading`

### 10.2 Banned Coding Practices
* **No Inline Style Sprawl**: Avoid inline `style={{ ... }}` blocks for layout, padding, font size, or color. Use CSS classes in the associated `.css` file. Inline styles are only permissible for dynamic runtime values (e.g. `style={{ width: `${progressPercentage}%` }}`).
* **No Undefined CSS Variables**: Never invent variables like `var(--color-surface)` or `var(--color-border)`. Use the exact tokens defined in [src/styles/theme.css](file:///c:/orderflownew/src/styles/theme.css).
* **No Direct Hex Overrides**: Never write `color: #000;` or `background: #fff;` in component CSS. Always use `var(--color-text-primary)` and `var(--color-bg-surface)`.

---

## 11. UI Feature Implementation & Review Checklist

Before declaring any UI task or component complete, verify every item on this checklist:

```markdown
- [ ] 1. Design Tokens: All colors, borders, and backgrounds use theme.css variables.
- [ ] 2. Layout Shell: Public, Auth, and Workspace shells are strictly separated.
- [ ] 3. Sticky Headers: App headers declare solid 96% background with blur(8px) and border.
- [ ] 4. Primary Button Rule: Only one primary (dark navy/accent) CTA per visual level.
- [ ] 5. Title Case Standard: Action buttons, table headers, and filter tabs use Title Case.
- [ ] 6. Typography: Strictly uses Inter; contrast meets WCAG AA (>= 4.5:1).
- [ ] 7. Localization: Currency uses ₦ with commas; Nigerian cities and phone formats.
- [ ] 8. Empty & Loading States: Every list has a clear skeleton/spinner and helpful empty state.
- [ ] 9. Mobile Responsiveness: Zero horizontal scrollbars at 375px; touch targets >= 44px.
- [ ] 10. CSS Hygiene: No inline style pollution; all classes follow the .of- prefix convention.
```
