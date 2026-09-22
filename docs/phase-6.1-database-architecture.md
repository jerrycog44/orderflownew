# OrderFlow — Phase 6.1 Database Architecture Specification

> **Document Status**: Production Architecture Blueprint  
> **Target Engine**: Supabase (PostgreSQL 15+)  
> **Migration Phase**: 6.1 (Architecture & Design — Application Code untouched)

---

## 1. Architecture Overview

OrderFlow’s backend architecture is designed for **Supabase PostgreSQL**, leveraging **Supabase Auth** (`auth.users`) as the single source of authentication identity. 

The schema adopts a clean **relational multi-tenant model** separating core user identity from role-specific business profiles (**Vendors** and **Logistics Providers**). It replaces transient `localStorage` arrays (`candidateQueue`, `declinedProviderIds`) with a fully normalized, audit-ready **Dispatch Opportunities Engine** that tracks provider targeting, queue ranking, acceptance, declines, and dispatch history.

### Core Architecture Principles
1. **Auth Integration**: `auth.users.id` acts as the primary key for the `profiles` table via a `1:1` mandatory foreign key relationship.
2. **Normalized Dispatch**: Replaces string arrays with the `dispatch_opportunities` table, preserving exact candidate rank order, response timestamps, and dispatch outcomes.
3. **Privacy & Public Tracking Security**: Enforces Row-Level Security (RLS) and exposes a restricted Postgres view/RPC function for unauthenticated recipient tracking without leaking vendor or provider PII.
4. **Realtime Ready**: Designed for Supabase Realtime WebSocket publications on state-changing tables (`deliveries`, `dispatch_opportunities`, `provider_availability`).
5. **WhatsApp Identity Compatible**: Mandatory E.164 formatted phone numbers (`phone`) on user profiles enable future friction-free WhatsApp OTP authentication and message triggers.

---

## 2. Entity Relationship Diagram (ERD)

```
                       ┌─────────────────────────┐
                       │   auth.users (Supabase) │
                       └────────────┬────────────┘
                                    │ 1:1
                       ┌────────────┴────────────┐
                       │        profiles         │
                       └─────┬──────────────┬────┘
                 1:1   │                    │ 1:1 (Role = logistics_provider)
         (Role = vendor)│                    │
          ┌────────────┴───┐          ┌─────┴────────────────┐
          │    vendors     │          │ logistics_providers  │
          └────────────┬───┘          └─┬──────────┬───────┬─┘
                       │                │ 1:1      │ 1:N   │ 1:N
                       │ 1:N            │          │       │
                       │     ┌──────────┴────────┐ │     ┌─┴─────────┐
                       │     │ provider_        │ │     │  drivers  │
                       │     │ availability     │ │     └─────┬─────┘
                       │     └──────────────────┘ │           │ 0..1:N
                       ▼                          ▼           │
             ┌─────────────────────────────────────────┐      │
             │               deliveries                │◄─────┘
             └────┬─────────────────┬───────────────┬──┘
                  │ 1:1             │ 1:N           │ 1:N
                  ▼                 ▼               ▼
         ┌────────────────┐ ┌───────────────┐ ┌───────────────────┐
         │package_details │ │   dispatch_   │ │  delivery_status_ │
         └────────────────┘ │ opportunities │ │      history      │
                            └───────────────┘ └───────────────────┘
```

---

## 3. Database Enums & Types

```sql
-- Application User Roles
CREATE TYPE user_role AS ENUM ('vendor', 'logistics_provider');

-- Provider Realtime Operational Availability Status
CREATE TYPE availability_status AS ENUM ('available', 'busy', 'unavailable');

-- Delivery Request Lifecycle Status
CREATE TYPE delivery_status AS ENUM (
  'draft',
  'searching',
  'opportunity_sent',
  'created',
  'provider_selected',
  'awaiting_pickup',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled'
);

-- Dispatch Operating Mode
CREATE TYPE dispatch_mode_enum AS ENUM ('auto', 'manual');

-- Package Classification Category
CREATE TYPE package_type_enum AS ENUM (
  'parcel',
  'box',
  'bag',
  'fragile_item',
  'other'
);

-- Dispatch Candidate Opportunity Status
CREATE TYPE opportunity_status_enum AS ENUM (
  'queued',
  'sent',
  'accepted',
  'declined',
  'expired',
  'skipped'
);
```

---

## 4. Complete Table Schema Definitions

### 4.1 `profiles`
Extends `auth.users` with shared user metadata across web and WhatsApp interfaces.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, REFERENCES `auth.users(id)` ON DELETE CASCADE | Matches Supabase Auth user UUID |
| `role` | `user_role` | NOT NULL | User application role (`vendor` or `logistics_provider`) |
| `full_name` | `text` | NOT NULL | Full display name |
| `email` | `text` | NOT NULL, UNIQUE | User email address |
| `phone` | `text` | NOT NULL, UNIQUE | E.164 formatted phone number (e.g. `+2348012345678`) |
| `avatar_url` | `text` | NULLABLE | Profile avatar image URL |
| `onboarding_completed` | `boolean` | DEFAULT `false` | True when mandatory onboarding wizard is completed |
| `created_at` | `timestamptz` | DEFAULT `now()` | Timestamp of profile creation |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Timestamp of last profile update |

---

### 4.2 `vendors`
Stores merchant business details. Linked 1:1 to `profiles`.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, REFERENCES `profiles(id)` ON DELETE CASCADE | Foreign key to `profiles.id` |
| `business_name` | `text` | NOT NULL | Registered business/shop name |
| `business_category` | `text` | NOT NULL | E.g. Electronics, Fashion, Grocery, General |
| `operating_city` | `text` | NOT NULL | Primary city of business operations |
| `created_at` | `timestamptz` | DEFAULT `now()` | Record creation timestamp |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Record update timestamp |

---

### 4.3 `logistics_providers`
Fleet operators and logistics partner profiles. Linked 1:1 to `profiles`.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, REFERENCES `profiles(id)` ON DELETE CASCADE | Foreign key to `profiles.id` |
| `provider_name` | `text` | NOT NULL | Company or fleet operator name |
| `provider_type` | `text` | NOT NULL | Fleet type (`courier`, `freight`, `van`, `motorcycle`, `mixed`) |
| `coverage_area` | `text` | NOT NULL | Primary operating hub city |
| `service_areas` | `text[]` | NOT NULL | Array of supported operational cities |
| `vehicle_types` | `text[]` | NOT NULL | Supported vehicle classifications |
| `package_categories`| `text[]` | NOT NULL | Supported package types |
| `logo_url` | `text` | NULLABLE | Company brand logo asset URL |
| `rating` | `numeric(3,2)` | DEFAULT `5.00` | Aggregate performance score (1.00 – 5.00) |
| `review_count` | `integer` | DEFAULT `0` | Total completed jobs rated |
| `created_at` | `timestamptz` | DEFAULT `now()` | Record creation timestamp |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Record update timestamp |

---

### 4.4 `provider_availability`
Tracks provider availability status in real time.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `provider_id` | `uuid` | PRIMARY KEY, REFERENCES `logistics_providers(id)` ON DELETE CASCADE | Foreign key to provider |
| `status` | `availability_status` | NOT NULL, DEFAULT `'available'` | `available` (Online), `busy`, `unavailable` (Offline) |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Timestamp of availability toggle |

---

### 4.5 `drivers`
Driver and vehicle profiles managed by logistics providers.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique driver identifier |
| `provider_id` | `uuid` | NOT NULL, REFERENCES `logistics_providers(id)` ON DELETE CASCADE | Fleet owner reference |
| `full_name` | `text` | NOT NULL | Driver full name |
| `phone` | `text` | NOT NULL | Driver contact phone number |
| `vehicle_plate` | `text` | NULLABLE | Vehicle license plate number |
| `vehicle_type` | `text` | NULLABLE | Driver vehicle type (e.g. Motorcycle) |
| `is_active` | `boolean` | DEFAULT `true` | Active status flag |
| `created_at` | `timestamptz` | DEFAULT `now()` | Record creation timestamp |

---

### 4.6 `deliveries`
Core delivery records created by vendors and assigned to providers/drivers.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique delivery record ID |
| `tracking_code` | `text` | NOT NULL, UNIQUE | Human-readable tracking code (e.g. `OF-849201`) |
| `vendor_id` | `uuid` | NOT NULL, REFERENCES `vendors(id)` ON DELETE RESTRICT | Creating vendor ID |
| `provider_id` | `uuid` | NULLABLE, REFERENCES `logistics_providers(id)` ON DELETE SET NULL | Assigned provider ID (NULL until matched) |
| `driver_id` | `uuid` | NULLABLE, REFERENCES `drivers(id)` ON DELETE SET NULL | Assigned driver ID |
| `status` | `delivery_status` | NOT NULL, DEFAULT `'searching'` | Lifecycle status |
| `dispatch_mode` | `dispatch_mode_enum` | NOT NULL, DEFAULT `'auto'` | Dispatch mode (`auto` vs `manual`) |
| `pickup_address` | `text` | NOT NULL | Full pickup street address |
| `pickup_city` | `text` | NOT NULL | Pickup city |
| `pickup_contact_name`| `text` | NULLABLE | Pickup contact person name |
| `pickup_contact_phone`| `text` | NULLABLE | Pickup contact phone number |
| `destination_address`| `text` | NOT NULL | Full dropoff street address |
| `destination_city` | `text` | NOT NULL | Dropoff city |
| `recipient_name` | `text` | NOT NULL | End-recipient name |
| `recipient_phone` | `text` | NOT NULL | End-recipient contact phone |
| `delivery_notes` | `text` | NULLABLE | Special handling notes |
| `estimated_price` | `numeric(10,2)` | NOT NULL | Total calculated delivery fare in NGN |
| `estimated_delivery_time`| `text` | NULLABLE | Estimated transit duration (e.g. "1–2 hours") |
| `created_at` | `timestamptz` | DEFAULT `now()` | Order creation timestamp |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Order last updated timestamp |

---

### 4.7 `package_details`
Normalizes parcel item specifications for a delivery (1:1 with `deliveries`).

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique package detail record ID |
| `delivery_id` | `uuid` | NOT NULL, UNIQUE, REFERENCES `deliveries(id)` ON DELETE CASCADE | Parent delivery ID |
| `product_name` | `text` | NOT NULL | Item name |
| `item_category` | `text` | NOT NULL | E.g. Electronics, Documents, Fashion |
| `package_type` | `package_type_enum` | NOT NULL | Package format (`parcel`, `box`, `bag`, etc.) |
| `quantity` | `integer` | DEFAULT `1` | Total item count |
| `weight_kg` | `numeric(6,2)` | NOT NULL | Weight in kilograms |
| `length_cm` | `numeric(6,2)` | NULLABLE | Dimension length in cm |
| `width_cm` | `numeric(6,2)` | NULLABLE | Dimension width in cm |
| `height_cm` | `numeric(6,2)` | NULLABLE | Dimension height in cm |
| `is_fragile` | `boolean` | DEFAULT `false` | Fragility toggle flag |
| `image_url` | `text` | NULLABLE | Optional package photo URL |
| `special_instructions`| `text` | NULLABLE | Specific package care instructions |

---

### 4.8 `dispatch_opportunities`
Replaces legacy `candidateQueue` and `declinedProviderIds` arrays with a clean relational dispatch log.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Opportunity record ID |
| `delivery_id` | `uuid` | NOT NULL, REFERENCES `deliveries(id)` ON DELETE CASCADE | Targeted delivery ID |
| `provider_id` | `uuid` | NOT NULL, REFERENCES `logistics_providers(id)` ON DELETE CASCADE | Targeted provider candidate |
| `rank_order` | `integer` | NOT NULL | Queue rank priority (1 = 1st candidate) |
| `status` | `opportunity_status_enum` | NOT NULL, DEFAULT `'queued'` | Status (`queued`, `sent`, `accepted`, `declined`, `expired`, `skipped`) |
| `sent_at` | `timestamptz` | NULLABLE | Timestamp when offer banner became active |
| `responded_at` | `timestamptz` | NULLABLE | Timestamp when provider clicked Accept or Decline |
| `created_at` | `timestamptz` | DEFAULT `now()` | Candidate queue generation timestamp |

> **Unique Constraint**: `UNIQUE(delivery_id, provider_id)`

---

### 4.9 `delivery_status_history`
Audit log for tracking status transitions across the delivery lifecycle.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Audit log entry ID |
| `delivery_id` | `uuid` | NOT NULL, REFERENCES `deliveries(id)` ON DELETE CASCADE | Tracked delivery ID |
| `previous_status` | `delivery_status` | NULLABLE | Status before state change |
| `new_status` | `delivery_status` | NOT NULL | New status applied |
| `changed_by_user_id`| `uuid` | NULLABLE, REFERENCES `profiles(id)` | User who triggered the state change |
| `notes` | `text` | NULLABLE | System or user log note |
| `created_at` | `timestamptz` | DEFAULT `now()` | Audit log timestamp |

---

## 5. Indexes Specification

```sql
-- 1. Deliveries lookup indexes
CREATE INDEX idx_deliveries_tracking_code ON deliveries(tracking_code);
CREATE INDEX idx_deliveries_vendor_id ON deliveries(vendor_id);
CREATE INDEX idx_deliveries_provider_id ON deliveries(provider_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);

-- 2. Dispatch Opportunities indexing for real-time provider targeted queries
CREATE INDEX idx_dispatch_opps_provider_status ON dispatch_opportunities(provider_id, status);
CREATE INDEX idx_dispatch_opps_delivery_rank ON dispatch_opportunities(delivery_id, rank_order);

-- 3. Profiles & Availability indexing
CREATE INDEX idx_profiles_phone ON profiles(phone);
CREATE INDEX idx_provider_availability_status ON provider_availability(status);
```

---

## 6. Dispatch Opportunity Lifecycle

When a Vendor creates an auto-dispatch delivery request:

1. **Queue Construction**: OrderFlow evaluates providers using `logisticsService` matching rules (matching service area, package support, and checking `provider_availability.status = 'available'`).
2. **Opportunities Insertion**: OrderFlow inserts rows into `dispatch_opportunities` for each eligible candidate with `rank_order = 1, 2, 3...` and `status = 'queued'`.
3. **Rank 1 Offer Dispatch**:
   - Update `dispatch_opportunities` where `rank_order = 1` to `status = 'sent'` and `sent_at = now()`.
   - Update `deliveries.status = 'opportunity_sent'`.
4. **Provider Response Handling**:
   - **ACCEPT**:
     - Update `dispatch_opportunities.status = 'accepted'` and `responded_at = now()`.
     - Update `deliveries.status = 'provider_selected'` and set `deliveries.provider_id`.
     - Update remaining queued opportunities for that delivery to `status = 'skipped'`.
   - **DECLINE**:
     - Update `dispatch_opportunities.status = 'declined'` and `responded_at = now()`.
     - Query `dispatch_opportunities` for next candidate where `rank_order = current + 1`.
     - If candidate exists: update candidate `status = 'sent'`, set `sent_at = now()`.
     - If queue exhausted: update `deliveries.status = 'searching'`.

---

## 7. Row-Level Security (RLS) Strategy

Row-Level Security ensures strict multi-tenant isolation at the database level.

### 7.1 `profiles`
- **SELECT**: Users can view their own profile (`auth.uid() = id`).
- **UPDATE**: Users can update their own profile (`auth.uid() = id`).

### 7.2 `vendors`
- **SELECT / UPDATE**: Vendors can access their own business record (`auth.uid() = id`).

### 7.3 `logistics_providers`
- **SELECT**: Authenticated users can view logistics provider public profiles (name, logo, vehicle types, ratings).
- **UPDATE**: Providers can update their own profile (`auth.uid() = id`).

### 7.4 `deliveries`
- **SELECT (Vendor)**: Vendors can select deliveries where `vendor_id = auth.uid()`.
- **SELECT (Provider)**: Providers can select deliveries where:
  1. `provider_id = auth.uid()`, OR
  2. An active opportunity exists in `dispatch_opportunities` where `provider_id = auth.uid()` AND `status = 'sent'`.
- **INSERT (Vendor)**: Vendors can create deliveries where `vendor_id = auth.uid()`.
- **UPDATE (Vendor)**: Vendors can cancel/update unassigned deliveries owned by them.
- **UPDATE (Provider)**: Assigned providers (`provider_id = auth.uid()`) can update `status` (e.g. `picked_up`, `in_transit`, `delivered`) and assign `driver_id`.

### 7.5 `dispatch_opportunities`
- **SELECT**: Providers can view opportunities where `provider_id = auth.uid()`. Vendors can view opportunities for deliveries they own.
- **UPDATE (Provider)**: Providers can update opportunity `status` (`accepted` or `declined`) where `provider_id = auth.uid()` and `status = 'sent'`.

### 7.6 `public_tracking_view` (Unauthenticated Tracking)
Public customers access tracking via a secure Postgres View or RPC function bypass without granting direct table read permissions:

```sql
CREATE VIEW public_tracking_view AS
SELECT 
  d.tracking_code,
  d.status,
  d.estimated_delivery_time,
  d.created_at,
  d.updated_at,
  p.product_name,
  v.business_name AS vendor_name,
  lp.provider_name,
  lp.logo_url AS provider_logo_url
FROM deliveries d
JOIN package_details p ON p.delivery_id = d.id
JOIN vendors v ON v.id = d.vendor_id
LEFT JOIN logistics_providers lp ON lp.id = d.provider_id;
```

---

## 8. Realtime Strategy

The following tables will be enabled for **Supabase Realtime** (`supabase_realtime` publication):

1. **`deliveries`**: Listens for `UPDATE` events on `status` and `provider_id` to update the Vendor Dashboard and Customer Tracking page instantly when a job is matched or progresses.
2. **`dispatch_opportunities`**: Listens for `INSERT` / `UPDATE` where `provider_id = auth.uid()` to show the pulsing **New Opportunity** banner on the Logistics Provider Dashboard in real time without manual browser refresh.
3. **`provider_availability`**: Listens for `UPDATE` to keep dispatch candidate queues up to date with real-time driver availability.

---

## 9. Future WhatsApp Identity & Messaging Compatibility

1. **Identity Key**: `profiles.phone` stores E.164 formatted numbers (`+234...`), allowing Supabase Auth to use WhatsApp OTP or SMS without schema modification.
2. **Message Triggers**: `delivery_status_history` insertions provide the clean database trigger hook required to send automated WhatsApp customer updates via Twilio / Meta WhatsApp Business API.

---

## 10. Migration Strategy from `localStorage`

When Phase 6.2 (Supabase Data Migration) begins:
1. Initialize the PostgreSQL schema via Supabase Migrations CLI (`supabase migration new init_schema`).
2. Create seed SQL scripts converting current `INITIAL_SEED_DELIVERIES` into INSERT statements.
3. Implement `supabaseClient.ts` wrapper mirroring existing `deliveryService` function signatures.
4. Replace `localStorage` calls inside `deliveryService.ts` with async Supabase queries while preserving component signatures.

---

## 11. Self-Audit & Technical Review

- **Files Created**: `docs/phase-6.1-database-architecture.md` (No code files altered; `localStorage` and app features untouched).
- **Proposed Tables**: 9 tables (`profiles`, `vendors`, `logistics_providers`, `provider_availability`, `drivers`, `deliveries`, `package_details`, `dispatch_opportunities`, `delivery_status_history`).
- **Key Architectural Decisions**:
  - Replaced array attributes with normalized `dispatch_opportunities` relational structure.
  - Used 1:1 `profiles` table to extend `auth.users`.
  - Exposed unauthenticated tracking through a PII-safe `public_tracking_view`.
- **Potential Risks**:
  - Race conditions during high-volume provider acceptances (mitigated by database transaction / RPC function `accept_dispatch_opportunity()`).
- **Recommended Next Step**: User review and approval of database blueprint before creating Supabase migration scripts in Phase 6.2.
