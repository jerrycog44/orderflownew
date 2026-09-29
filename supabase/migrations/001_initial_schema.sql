-- ============================================================================
-- ORDERFLOW DATABASE MIGRATION 001: INITIAL SCHEMA & SECURITY POLICIES
-- Target Engine: Supabase PostgreSQL 15+
-- Architecture Blueprint: docs/phase-6.1-database-architecture.md
-- Fully Idempotent Migration Script (Safe to re-run multiple times)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CUSTOM ENUMS
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('vendor', 'logistics_provider');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE availability_status AS ENUM ('available', 'busy', 'unavailable');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dispatch_mode_enum AS ENUM ('auto', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE package_type_enum AS ENUM (
    'parcel',
    'box',
    'bag',
    'fragile_item',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_status_enum AS ENUM (
    'queued',
    'sent',
    'accepted',
    'declined',
    'expired',
    'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. UPDATED_AT TRIGGER FUNCTION
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3. APPLICATION TABLES
-- ----------------------------------------------------------------------------

-- Table 1: PROFILES (Extends auth.users 1:1)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_profiles_phone_format CHECK (phone ~ '^\+[1-9]\d{1,14}$')
);

DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table 2: VENDORS (1:1 with profiles)
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_category TEXT NOT NULL,
  operating_city TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_vendors_updated_at ON vendors;
CREATE TRIGGER set_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table 3: LOGISTICS_PROVIDERS (1:1 with profiles)
CREATE TABLE IF NOT EXISTS logistics_providers (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  coverage_area TEXT NOT NULL,
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  vehicle_types TEXT[] NOT NULL DEFAULT '{}',
  package_categories TEXT[] NOT NULL DEFAULT '{}',
  logo_url TEXT,
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.00 CHECK (rating >= 1.00 AND rating <= 5.00),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_logistics_providers_updated_at ON logistics_providers;
CREATE TRIGGER set_logistics_providers_updated_at
  BEFORE UPDATE ON logistics_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table 4: PROVIDER_AVAILABILITY (1:1 with logistics_providers)
CREATE TABLE IF NOT EXISTS provider_availability (
  provider_id UUID PRIMARY KEY REFERENCES logistics_providers(id) ON DELETE CASCADE,
  status availability_status NOT NULL DEFAULT 'available',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_provider_availability_updated_at ON provider_availability;
CREATE TRIGGER set_provider_availability_updated_at
  BEFORE UPDATE ON provider_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table 5: DRIVERS (Managed by logistics_providers)
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES logistics_providers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_plate TEXT,
  vehicle_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 6: DELIVERIES
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code TEXT NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  provider_id UUID REFERENCES logistics_providers(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  status delivery_status NOT NULL DEFAULT 'searching',
  dispatch_mode dispatch_mode_enum NOT NULL DEFAULT 'auto',
  pickup_address TEXT NOT NULL,
  pickup_city TEXT NOT NULL,
  pickup_contact_name TEXT,
  pickup_contact_phone TEXT,
  destination_address TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  delivery_notes TEXT,
  estimated_price NUMERIC(10,2) NOT NULL CHECK (estimated_price >= 0),
  estimated_delivery_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_deliveries_updated_at ON deliveries;
CREATE TRIGGER set_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table 7: PACKAGE_DETAILS (1:1 with deliveries)
CREATE TABLE IF NOT EXISTS package_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL UNIQUE REFERENCES deliveries(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  item_category TEXT NOT NULL,
  package_type package_type_enum NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  weight_kg NUMERIC(6,2) NOT NULL CHECK (weight_kg > 0),
  length_cm NUMERIC(6,2) CHECK (length_cm >= 0),
  width_cm NUMERIC(6,2) CHECK (width_cm >= 0),
  height_cm NUMERIC(6,2) CHECK (height_cm >= 0),
  is_fragile BOOLEAN NOT NULL DEFAULT FALSE,
  image_url TEXT,
  special_instructions TEXT
);

-- Table 8: DISPATCH_OPPORTUNITIES
CREATE TABLE IF NOT EXISTS dispatch_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES logistics_providers(id) ON DELETE CASCADE,
  rank_order INTEGER NOT NULL CHECK (rank_order > 0),
  status opportunity_status_enum NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dispatch_opp_delivery_provider UNIQUE (delivery_id, provider_id)
);

-- Table 9: DELIVERY_STATUS_HISTORY
CREATE TABLE IF NOT EXISTS delivery_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  previous_status delivery_status,
  new_status delivery_status NOT NULL,
  changed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. INDEXES
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_deliveries_tracking_code ON deliveries(tracking_code);
CREATE INDEX IF NOT EXISTS idx_deliveries_vendor_id ON deliveries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_provider_id ON deliveries(provider_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_opps_provider_status ON dispatch_opportunities(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_dispatch_opps_delivery_rank ON dispatch_opportunities(delivery_id, rank_order);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_provider_availability_status ON provider_availability(status);

-- ----------------------------------------------------------------------------
-- 5. SECURE PUBLIC TRACKING VIEW & RPC FUNCTION
-- Exposes ONLY non-sensitive tracking information to unauthenticated visitors.
-- Excludes recipient phone, vendor contact, and provider private internal details.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public_tracking_view
WITH (security_invoker = true) AS
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

-- Secure RPC function for tracking lookup by code
CREATE OR REPLACE FUNCTION get_public_tracking(p_tracking_code TEXT)
RETURNS TABLE (
  tracking_code TEXT,
  status delivery_status,
  estimated_delivery_time TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  product_name TEXT,
  vendor_name TEXT,
  provider_name TEXT,
  provider_logo_url TEXT
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT 
    v.tracking_code,
    v.status,
    v.estimated_delivery_time,
    v.created_at,
    v.updated_at,
    v.product_name,
    v.vendor_name,
    v.provider_name,
    v.provider_logo_url
  FROM public_tracking_view v
  WHERE LOWER(v.tracking_code) = LOWER(TRIM(p_tracking_code))
  LIMIT 1;
$function$;

-- Grant execution of public tracking RPC to anonymous visitors
GRANT EXECUTE ON FUNCTION get_public_tracking(TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. RLS AUTHORIZATION SECURITY DEFINER HELPER FUNCTIONS
-- Breaks circular RLS evaluation dependency between deliveries and dispatch_opportunities
-- ----------------------------------------------------------------------------

-- Helper 1: Checks if provider has an active sent opportunity for a delivery
CREATE OR REPLACE FUNCTION has_active_dispatch_opportunity(p_delivery_id UUID, p_provider_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM dispatch_opportunities dop
    WHERE dop.delivery_id = p_delivery_id
      AND dop.provider_id = p_provider_id
      AND dop.status = 'sent'
  );
$function$;

-- Helper 2: Checks if vendor is the owner of a delivery
CREATE OR REPLACE FUNCTION is_delivery_owner(p_delivery_id UUID, p_vendor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.id = p_delivery_id
      AND d.vendor_id = p_vendor_id
  );
$function$;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

-- Enable RLS on all 9 application tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_status_history ENABLE ROW LEVEL SECURITY;

-- POLICIES: PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile on signup" ON profiles;
DROP POLICY IF EXISTS "Users can manage their own profile" ON profiles;
CREATE POLICY "Users can manage their own profile"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- POLICIES: VENDORS
DROP POLICY IF EXISTS "Vendors can view their own record" ON vendors;
DROP POLICY IF EXISTS "Vendors can insert their own record" ON vendors;
DROP POLICY IF EXISTS "Vendors can update their own record" ON vendors;
DROP POLICY IF EXISTS "Vendors can manage their own record" ON vendors;
CREATE POLICY "Vendors can manage their own record"
  ON vendors FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- POLICIES: LOGISTICS_PROVIDERS
DROP POLICY IF EXISTS "Public authenticated users can view provider profiles" ON logistics_providers;
CREATE POLICY "Public authenticated users can view provider profiles"
  ON logistics_providers FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Providers can insert their own record" ON logistics_providers;
DROP POLICY IF EXISTS "Providers can update their own record" ON logistics_providers;
DROP POLICY IF EXISTS "Providers can manage their own record" ON logistics_providers;
CREATE POLICY "Providers can manage their own record"
  ON logistics_providers FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- POLICIES: PROVIDER_AVAILABILITY
DROP POLICY IF EXISTS "Authenticated users can view provider availability" ON provider_availability;
CREATE POLICY "Authenticated users can view provider availability"
  ON provider_availability FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Providers can update their own availability" ON provider_availability;
CREATE POLICY "Providers can update their own availability"
  ON provider_availability FOR ALL
  USING (auth.uid() = provider_id)
  WITH CHECK (auth.uid() = provider_id);

-- POLICIES: DRIVERS
DROP POLICY IF EXISTS "Providers can manage their own fleet drivers" ON drivers;
CREATE POLICY "Providers can manage their own fleet drivers"
  ON drivers FOR ALL
  USING (auth.uid() = provider_id)
  WITH CHECK (auth.uid() = provider_id);

-- POLICIES: DELIVERIES
DROP POLICY IF EXISTS "Vendors can view their own created deliveries" ON deliveries;
CREATE POLICY "Vendors can view their own created deliveries"
  ON deliveries FOR SELECT
  USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Providers can view assigned or targeted deliveries" ON deliveries;
CREATE POLICY "Providers can view assigned or targeted deliveries"
  ON deliveries FOR SELECT
  USING (
    provider_id = auth.uid() OR
    has_active_dispatch_opportunity(id, auth.uid())
  );

DROP POLICY IF EXISTS "Vendors can create deliveries" ON deliveries;
CREATE POLICY "Vendors can create deliveries"
  ON deliveries FOR INSERT
  WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Vendors can update unassigned deliveries" ON deliveries;
CREATE POLICY "Vendors can update unassigned deliveries"
  ON deliveries FOR UPDATE
  USING (auth.uid() = vendor_id AND (status = 'created' OR status = 'searching' OR status = 'draft'));

DROP POLICY IF EXISTS "Assigned providers can update status of assigned deliveries" ON deliveries;
CREATE POLICY "Assigned providers can update status of assigned deliveries"
  ON deliveries FOR UPDATE
  USING (provider_id = auth.uid());

-- POLICIES: PACKAGE_DETAILS
DROP POLICY IF EXISTS "Vendors can view package details for their deliveries" ON package_details;
CREATE POLICY "Vendors can view package details for their deliveries"
  ON package_details FOR SELECT
  USING (is_delivery_owner(delivery_id, auth.uid()));

DROP POLICY IF EXISTS "Providers can view package details for targeted/assigned deliveries" ON package_details;
CREATE POLICY "Providers can view package details for targeted/assigned deliveries"
  ON package_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = package_details.delivery_id AND d.provider_id = auth.uid()
    ) OR
    has_active_dispatch_opportunity(delivery_id, auth.uid())
  );

DROP POLICY IF EXISTS "Vendors can insert package details for their deliveries" ON package_details;
CREATE POLICY "Vendors can insert package details for their deliveries"
  ON package_details FOR INSERT
  WITH CHECK (is_delivery_owner(delivery_id, auth.uid()));

-- POLICIES: DISPATCH_OPPORTUNITIES
DROP POLICY IF EXISTS "Providers can view opportunities sent to them" ON dispatch_opportunities;
CREATE POLICY "Providers can view opportunities sent to them"
  ON dispatch_opportunities FOR SELECT
  USING (provider_id = auth.uid());

DROP POLICY IF EXISTS "Vendors can view opportunities for their deliveries" ON dispatch_opportunities;
CREATE POLICY "Vendors can view opportunities for their deliveries"
  ON dispatch_opportunities FOR SELECT
  USING (is_delivery_owner(delivery_id, auth.uid()));

DROP POLICY IF EXISTS "Providers can update opportunity response status" ON dispatch_opportunities;
CREATE POLICY "Providers can update opportunity response status"
  ON dispatch_opportunities FOR UPDATE
  USING (provider_id = auth.uid() AND status = 'sent')
  WITH CHECK (provider_id = auth.uid());

-- POLICIES: DELIVERY_STATUS_HISTORY
DROP POLICY IF EXISTS "Users can view status history for their relevant deliveries" ON delivery_status_history;
CREATE POLICY "Users can view status history for their relevant deliveries"
  ON delivery_status_history FOR SELECT
  USING (
    is_delivery_owner(delivery_id, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_status_history.delivery_id AND d.provider_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 8. REALTIME PUBLICATION SETUP
-- Enable Realtime broadcasting on state-critical tables safely
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_opportunities;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE provider_availability;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- END OF MIGRATION 001
-- ============================================================================
