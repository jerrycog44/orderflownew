-- ============================================================================
-- ORDERFLOW DATABASE MIGRATION 005: POD, PAYMENT INTEGRITY & RLS HARDENING
-- Run AFTER migrations 001, 002, 003 and 004.
--
-- Scope (Phase 1 Approved Specification):
--   1. Private transaction-scoped, burn-on-use capability architecture
--      (orderflow_internal.trusted_capabilities) replacing user-modifiable
--      custom GUC reliance and blocking nested SECURITY DEFINER bypasses.
--   2. Nullable legacy payment fields + strict INSERT/UPDATE payment integrity
--      triggers (prepaid_online disabled until verified gateway integration).
--   3. Server-side POD secret storage (delivery_pod_secrets), active-delivery
--      backfill, elimination of client PIN bypasses, 5-attempt brute-force
--      lockout, complete_delivery_with_pod, and rotate_delivery_pod_secrets.
--   4. Public tracking (get_public_tracking) Case A / B / C disclosure matrix
--      using SHA-256 constant-length comparison on 244-bit recipient tokens.
--   5. Revocation of direct client write privileges/policies on delivery tables,
--      replacement of FOR ALL policies, provider reputation protection,
--      search_path pinning, deduplicated profiles.phone normalization, and
--      explicit function privilege matrix.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ============================================================================
-- 1. PRIVATE CAPABILITY SCHEMA & INTERNAL CRYPTOGRAPHIC HELPERS
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS orderflow_internal;
REVOKE ALL ON SCHEMA orderflow_internal FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS orderflow_internal.trusted_capabilities (
  txid       xid8 NOT NULL DEFAULT pg_current_xact_id(),
  target_id  UUID NOT NULL,
  capability TEXT NOT NULL CHECK (capability IN (
    'dispatch',
    'pod_attempt',
    'pod_reset',
    'pod_complete',
    'verified_payment',
    'provider_reputation'
  )),
  PRIMARY KEY (txid, target_id, capability)
);

REVOKE ALL ON TABLE orderflow_internal.trusted_capabilities FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION orderflow_internal.grant_capability(
  p_target_id UUID,
  p_capability TEXT
) RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO orderflow_internal.trusted_capabilities (txid, target_id, capability)
  VALUES (pg_current_xact_id(), p_target_id, p_capability)
  ON CONFLICT (txid, target_id, capability) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION orderflow_internal.grant_capability(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION orderflow_internal.has_capability(
  p_target_id UUID,
  p_capability TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM orderflow_internal.trusted_capabilities
    WHERE txid = pg_current_xact_id()
      AND target_id = p_target_id
      AND capability = p_capability
  );
$$;

REVOKE ALL ON FUNCTION orderflow_internal.has_capability(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

-- Uniform 4-digit PIN generator (1000..9999, never '0000') using rejection
-- sampling over pure CSPRNG bytes 0..1 of uuid_send(gen_random_uuid()).
CREATE OR REPLACE FUNCTION orderflow_internal.generate_pod_pin()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bytes BYTEA;
  v_val   INT;
BEGIN
  LOOP
    v_bytes := uuid_send(gen_random_uuid());
    v_val := ((get_byte(v_bytes, 0) & 63) << 8) | get_byte(v_bytes, 1); -- 0..16383
    EXIT WHEN v_val < 9000;
  END LOOP;
  RETURN (1000 + v_val)::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION orderflow_internal.generate_pod_pin()
  FROM PUBLIC, anon, authenticated, service_role;

-- 64-character lowercase hex recipient capability token (~244 bits CSPRNG entropy).
CREATE OR REPLACE FUNCTION orderflow_internal.generate_recipient_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT lower(
    replace(gen_random_uuid()::TEXT, '-', '') ||
    replace(gen_random_uuid()::TEXT, '-', '')
  );
$$;

REVOKE ALL ON FUNCTION orderflow_internal.generate_recipient_token()
  FROM PUBLIC, anon, authenticated, service_role;


-- ============================================================================
-- 2. HARDEN EXISTING UTILITY FUNCTIONS & PROFILES PHONE CONSTRAINT (OF-031)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_updated_at_column()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._dispatch_offer_ttl()
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT INTERVAL '120 seconds' $$;

REVOKE ALL ON FUNCTION public._dispatch_offer_ttl()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._generate_tracking_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_alphabet CONSTANT TEXT := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes BYTEA := uuid_send(gen_random_uuid());
  v_positions CONSTANT INT[] := ARRAY[0, 1, 2, 3, 4, 5, 9, 10];
  v_code TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_positions[i]) % 32) + 1, 1);
  END LOOP;
  RETURN 'OF-' || substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
END;
$$;

REVOKE ALL ON FUNCTION public._generate_tracking_code()
  FROM PUBLIC, anon, authenticated, service_role;

-- Drop unused SECURITY DEFINER helper from migrations 001/003.
DROP FUNCTION IF EXISTS public.has_active_dispatch_opportunity(UUID, UUID);

-- Caller-bound ownership helper: prevents probing arbitrary (delivery_id, vendor_id) pairs.
CREATE OR REPLACE FUNCTION public.is_delivery_owner(p_delivery_id UUID, p_vendor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.deliveries d
    WHERE d.id = p_delivery_id
      AND d.vendor_id = p_vendor_id
      AND p_vendor_id = auth.uid()
  );
$function$;

REVOKE ALL ON FUNCTION public.is_delivery_owner(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_delivery_owner(UUID, UUID) TO authenticated, service_role;

-- Sanitize existing profiles.phone values prior to restoring chk_profiles_phone_format.
-- Deduplicates normalized numbers in created_at order so profiles_phone_key (UNIQUE) cannot collide.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_profiles_phone_format;

WITH cleaned AS (
  SELECT
    p.id,
    p.created_at,
    CASE
      WHEN regexp_replace(btrim(COALESCE(p.phone, '')), '[\s\-().]', '', 'g') ~ '^\+?[0-9]{7,15}$'
        THEN regexp_replace(btrim(p.phone), '[\s\-().]', '', 'g')
      ELSE NULL
    END AS norm_phone
  FROM public.profiles p
  WHERE p.phone IS NOT NULL
),
ranked AS (
  SELECT
    c.id,
    CASE
      WHEN c.norm_phone IS NULL THEN NULL
      WHEN ROW_NUMBER() OVER (PARTITION BY c.norm_phone ORDER BY c.created_at ASC, c.id ASC) = 1
        THEN c.norm_phone
      ELSE NULL
    END AS final_phone
  FROM cleaned c
)
UPDATE public.profiles p
SET phone = r.final_phone
FROM ranked r
WHERE p.id = r.id
  AND p.phone IS DISTINCT FROM r.final_phone;

CREATE OR REPLACE FUNCTION public.normalize_profile_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := NULLIF(regexp_replace(btrim(NEW.phone), '[\s\-().]', '', 'g'), '');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_profile_phone()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_a_normalize_profile_phone ON public.profiles;
CREATE TRIGGER trg_a_normalize_profile_phone
  BEFORE INSERT OR UPDATE OF phone ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_profile_phone();

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_phone_format
  CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{7,15}$');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_phone TEXT;
BEGIN
  v_raw_phone := NULLIF(regexp_replace(btrim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '[\s\-().]', '', 'g'), '');
  IF v_raw_phone IS NOT NULL AND v_raw_phone !~ '^\+?[0-9]{7,15}$' THEN
    v_raw_phone := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    onboarding_completed
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''), 'User'),
    NULLIF(btrim(NEW.email), ''),
    v_raw_phone,
    NULL,
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated, service_role;


-- ============================================================================
-- 3. PAYMENT & PROOF-OF-DELIVERY SCHEMA + LEGACY BACKFILL (OF-001, OF-002)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'payment_method_enum'
  ) THEN
    CREATE TYPE public.payment_method_enum AS ENUM (
      'cash_on_delivery',
      'pay_at_pickup',
      'prepaid_online'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'payment_status_enum'
  ) THEN
    CREATE TYPE public.payment_status_enum AS ENUM (
      'pending',
      'collected',
      'remitted'
    );
  END IF;
END $$;

-- Nullable payment_method & payment_status preserve NULL for historical pre-005
-- orders whose payment terms were never recorded, while post-005 inserts require both.
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method_enum,
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status_enum,
  ADD COLUMN IF NOT EXISTS require_photo_proof BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pod_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS pod_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pod_failed_attempts INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.deliveries'::regclass
      AND conname = 'chk_deliveries_payment_pair'
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT chk_deliveries_payment_pair
      CHECK ((payment_method IS NULL) = (payment_status IS NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.deliveries'::regclass
      AND conname = 'chk_deliveries_pod_failed_attempts'
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT chk_deliveries_pod_failed_attempts
      CHECK (pod_failed_attempts >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.deliveries'::regclass
      AND conname = 'chk_deliveries_pod_photo_url'
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT chk_deliveries_pod_photo_url
      CHECK (
        pod_photo_url IS NULL OR (
          octet_length(pod_photo_url) <= 2097152
          AND pod_photo_url ~ '^(https://[[:graph:]]+|data:image/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+)$'
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.delivery_pod_secrets (
  delivery_id      UUID PRIMARY KEY REFERENCES public.deliveries(id) ON DELETE CASCADE,
  pin_code         TEXT NOT NULL CHECK (pin_code ~ '^[1-9][0-9]{3}$'),
  recipient_token  TEXT NOT NULL CHECK (recipient_token ~ '^[0-9a-f]{64}$'),
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  token_revoked_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_delivery_pod_secrets_updated_at ON public.delivery_pod_secrets;
CREATE TRIGGER set_delivery_pod_secrets_updated_at
  BEFORE UPDATE ON public.delivery_pod_secrets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.delivery_pod_secrets ENABLE ROW LEVEL SECURITY;

-- Backfill POD secrets ONLY for existing active (non-terminal) deliveries.
-- ON CONFLICT DO NOTHING ensures re-running migration 005 never overwrites live PINs/tokens.
INSERT INTO public.delivery_pod_secrets (
  delivery_id,
  pin_code,
  recipient_token,
  token_expires_at
)
SELECT
  d.id,
  orderflow_internal.generate_pod_pin(),
  orderflow_internal.generate_recipient_token(),
  NOW() + INTERVAL '7 days'
FROM public.deliveries d
WHERE d.status NOT IN ('delivered', 'cancelled')
ON CONFLICT (delivery_id) DO NOTHING;


-- ============================================================================
-- 4. TABLE PRIVILEGE REVOCATIONS & RLS POLICY HARDENING (OF-004, OF-014)
-- ============================================================================

-- Kernel-level write privilege revocation on RPC-mediated tables.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE
  public.deliveries,
  public.package_details,
  public.dispatch_opportunities,
  public.delivery_pod_secrets,
  public.delivery_status_history
FROM PUBLIC, anon, authenticated;

REVOKE SELECT ON TABLE
  public.deliveries,
  public.package_details,
  public.dispatch_opportunities,
  public.delivery_pod_secrets,
  public.delivery_status_history
FROM PUBLIC, anon;

GRANT SELECT ON TABLE
  public.deliveries,
  public.package_details,
  public.dispatch_opportunities,
  public.delivery_pod_secrets,
  public.delivery_status_history
TO authenticated, service_role;

GRANT ALL ON TABLE
  public.deliveries,
  public.package_details,
  public.dispatch_opportunities,
  public.delivery_pod_secrets,
  public.delivery_status_history
TO service_role;

-- Block destructive client DELETEs on core account/availability tables.
REVOKE DELETE, TRUNCATE ON TABLE
  public.profiles,
  public.vendors,
  public.logistics_providers,
  public.provider_availability
FROM PUBLIC, anon, authenticated;

-- 4a. DELIVERY_POD_SECRETS RLS (Vendor owner SELECT only; zero courier/anon access)
DROP POLICY IF EXISTS "Vendors can view POD secrets for own deliveries" ON public.delivery_pod_secrets;
CREATE POLICY "Vendors can view POD secrets for own deliveries"
  ON public.delivery_pod_secrets FOR SELECT
  TO authenticated
  USING (public.is_delivery_owner(delivery_id, auth.uid()));

-- 4b. DELIVERIES & PACKAGE_DETAILS: Drop leftover direct client write policies
DROP POLICY IF EXISTS "Vendors can create deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Vendors can update unassigned deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Vendors can update own deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Assigned providers can update status of assigned deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Assigned providers can update delivery status" ON public.deliveries;
DROP POLICY IF EXISTS "Vendors can insert package details for their deliveries" ON public.package_details;
DROP POLICY IF EXISTS "Vendors can insert package details" ON public.package_details;

-- 4c. PROFILES: Replace FOR ALL with explicit SELECT / INSERT / UPDATE (no DELETE)
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile on signup" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile on signup"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4d. VENDORS: Replace FOR ALL with explicit SELECT / INSERT / UPDATE (no DELETE)
DROP POLICY IF EXISTS "Vendors can manage their own record" ON public.vendors;
DROP POLICY IF EXISTS "Vendors can manage own record" ON public.vendors;
DROP POLICY IF EXISTS "Vendors can view their own record" ON public.vendors;
DROP POLICY IF EXISTS "Assigned providers can view vendor for assigned deliveries" ON public.vendors;
DROP POLICY IF EXISTS "Vendors can insert their own record" ON public.vendors;
DROP POLICY IF EXISTS "Vendors can update their own record" ON public.vendors;

CREATE POLICY "Vendors can view their own record"
  ON public.vendors FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Assigned providers can view vendor for assigned deliveries"
  ON public.vendors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.vendor_id = vendors.id
        AND d.provider_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can insert their own record"
  ON public.vendors FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Vendors can update their own record"
  ON public.vendors FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4e. LOGISTICS_PROVIDERS: Replace FOR ALL with INSERT / UPDATE (001 SELECT policy kept)
DROP POLICY IF EXISTS "Providers can manage their own record" ON public.logistics_providers;
DROP POLICY IF EXISTS "Providers can manage own record" ON public.logistics_providers;
DROP POLICY IF EXISTS "Providers can insert their own record" ON public.logistics_providers;
DROP POLICY IF EXISTS "Providers can update their own record" ON public.logistics_providers;

CREATE POLICY "Providers can insert their own record"
  ON public.logistics_providers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Providers can update their own record"
  ON public.logistics_providers FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4f. PROVIDER_AVAILABILITY: Replace FOR ALL with INSERT / UPDATE (001 SELECT policy kept)
DROP POLICY IF EXISTS "Providers can update their own availability" ON public.provider_availability;
DROP POLICY IF EXISTS "Providers can manage own availability" ON public.provider_availability;
DROP POLICY IF EXISTS "Providers can insert their own availability" ON public.provider_availability;
DROP POLICY IF EXISTS "Providers can modify their own availability" ON public.provider_availability;

CREATE POLICY "Providers can insert their own availability"
  ON public.provider_availability FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Providers can modify their own availability"
  ON public.provider_availability FOR UPDATE
  TO authenticated
  USING (auth.uid() = provider_id)
  WITH CHECK (auth.uid() = provider_id);

-- 4g. DRIVERS: Replace FOR ALL with explicit SELECT / INSERT / UPDATE + guarded DELETE
DROP POLICY IF EXISTS "Providers can manage their own fleet drivers" ON public.drivers;
DROP POLICY IF EXISTS "Providers can manage own drivers" ON public.drivers;
DROP POLICY IF EXISTS "Providers can view own fleet drivers" ON public.drivers;
DROP POLICY IF EXISTS "Providers can insert own fleet drivers" ON public.drivers;
DROP POLICY IF EXISTS "Providers can update own fleet drivers" ON public.drivers;
DROP POLICY IF EXISTS "Providers can delete unassigned fleet drivers" ON public.drivers;

CREATE POLICY "Providers can view own fleet drivers"
  ON public.drivers FOR SELECT
  TO authenticated
  USING (auth.uid() = provider_id);

CREATE POLICY "Providers can insert own fleet drivers"
  ON public.drivers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Providers can update own fleet drivers"
  ON public.drivers FOR UPDATE
  TO authenticated
  USING (auth.uid() = provider_id)
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Providers can delete unassigned fleet drivers"
  ON public.drivers FOR DELETE
  TO authenticated
  USING (
    auth.uid() = provider_id
    AND NOT EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.driver_id = drivers.id
        AND d.status NOT IN ('delivered', 'cancelled')
    )
  );


-- ============================================================================
-- 5. CAPABILITY-BACKED REPUTATION, PAYMENT & DELIVERY TRIGGERS
-- ============================================================================

-- 5a. Provider Reputation Guard (blocks direct AND nested SECURITY DEFINER spoofing)
CREATE OR REPLACE FUNCTION public.guard_provider_reputation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF orderflow_internal.has_capability(NEW.id, 'provider_reputation') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.rating IS DISTINCT FROM 5.00 OR NEW.review_count IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'Provider rating and review_count must initialize to defaults (5.00, 0)'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.rating IS DISTINCT FROM OLD.rating
       OR NEW.review_count IS DISTINCT FROM OLD.review_count THEN
      RAISE EXCEPTION 'Provider rating and review_count cannot be modified without verified review capability'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_provider_reputation()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_provider_capabilities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM orderflow_internal.trusted_capabilities
  WHERE txid = pg_current_xact_id()
    AND target_id = NEW.id
    AND capability = 'provider_reputation';
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_provider_capabilities()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_guard_provider_reputation ON public.logistics_providers;
CREATE TRIGGER trg_guard_provider_reputation
  BEFORE INSERT OR UPDATE ON public.logistics_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_provider_reputation();

DROP TRIGGER IF EXISTS trg_z_consume_provider_capabilities ON public.logistics_providers;
CREATE TRIGGER trg_z_consume_provider_capabilities
  AFTER INSERT OR UPDATE ON public.logistics_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.consume_provider_capabilities();


-- 5b. Delivery Payment & POD Integrity Trigger (fires BEFORE trg_guard_* and trg_validate_*)
CREATE OR REPLACE FUNCTION public.enforce_delivery_payment_and_pod()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pod_complete BOOLEAN;
  v_pod_attempt  BOOLEAN;
  v_pod_reset    BOOLEAN;
  v_verified_pay BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_method IS NULL OR NEW.payment_status IS NULL THEN
      RAISE EXCEPTION 'New deliveries require non-null payment_method and payment_status'
        USING ERRCODE = '23502';
    END IF;

    IF NEW.payment_method = 'prepaid_online' THEN
      RAISE EXCEPTION 'Online prepaid payment is unavailable until verified payment gateway integration is enabled'
        USING ERRCODE = '22023';
    END IF;

    IF NEW.payment_status <> 'pending' THEN
      RAISE EXCEPTION 'New deliveries must initialize with payment_status = pending'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.status = 'delivered'
       OR NEW.pod_completed_at IS NOT NULL
       OR NEW.pod_photo_url IS NOT NULL
       OR NEW.pod_failed_attempts <> 0 THEN
      RAISE EXCEPTION 'Cannot insert a pre-completed or pre-attempted delivery'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE'
  v_pod_complete := orderflow_internal.has_capability(NEW.id, 'pod_complete');
  v_pod_attempt  := orderflow_internal.has_capability(NEW.id, 'pod_attempt');
  v_pod_reset    := orderflow_internal.has_capability(NEW.id, 'pod_reset');
  v_verified_pay := orderflow_internal.has_capability(NEW.id, 'verified_payment');

  -- Rule U-1: Legacy deliveries (NULL, NULL) retain NULL payment fields.
  IF OLD.payment_method IS NULL THEN
    IF NEW.payment_method IS NOT NULL OR NEW.payment_status IS NOT NULL THEN
      RAISE EXCEPTION 'Historical unrecorded payment fields cannot be retroactively populated on update'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    -- Rule U-2: Recorded payment_method is immutable (cannot change or clear to NULL).
    IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
      RAISE EXCEPTION 'payment_method is immutable once recorded'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.payment_status IS NULL THEN
      RAISE EXCEPTION 'payment_status cannot be cleared to NULL'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Rule U-3: Reject prepaid_online unconditionally.
  IF NEW.payment_method = 'prepaid_online' THEN
    RAISE EXCEPTION 'Online prepaid payment is unavailable'
      USING ERRCODE = '22023';
  END IF;

  -- Rule U-4: Payment status transitions.
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF OLD.payment_status = 'pending' AND NEW.payment_status = 'collected' THEN
      IF NOT (
        (OLD.payment_method = 'cash_on_delivery' AND NEW.status = 'delivered' AND v_pod_complete)
        OR v_verified_pay
      ) THEN
        RAISE EXCEPTION 'payment_status can only become collected upon verified COD POD handover or verified payment event'
          USING ERRCODE = '42501';
      END IF;
    ELSIF OLD.payment_status = 'collected' AND NEW.payment_status = 'remitted' THEN
      IF NOT v_verified_pay THEN
        RAISE EXCEPTION 'payment_status can only become remitted via verified settlement'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid payment_status transition from % to %', OLD.payment_status, NEW.payment_status
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Rule U-5: POD completion & attempt fields.
  IF OLD.status <> 'delivered' AND NEW.status = 'delivered' AND NOT v_pod_complete THEN
    RAISE EXCEPTION 'Deliveries can only transition to delivered via complete_delivery_with_pod'
      USING ERRCODE = '42501';
  END IF;

  IF (NEW.pod_photo_url IS DISTINCT FROM OLD.pod_photo_url
      OR NEW.pod_completed_at IS DISTINCT FROM OLD.pod_completed_at)
     AND NOT v_pod_complete THEN
    RAISE EXCEPTION 'POD completion artifacts can only be recorded via complete_delivery_with_pod'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.pod_failed_attempts IS DISTINCT FROM OLD.pod_failed_attempts THEN
    IF v_pod_attempt AND NEW.pod_failed_attempts = OLD.pod_failed_attempts + 1 THEN
      NULL;
    ELSIF v_pod_reset AND NEW.pod_failed_attempts = 0 THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'pod_failed_attempts may only be modified by POD verification RPCs'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_delivery_payment_and_pod()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_enforce_delivery_payment_and_pod ON public.deliveries;
CREATE TRIGGER trg_enforce_delivery_payment_and_pod
  BEFORE INSERT OR UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_delivery_payment_and_pod();


-- 5c. Delivery Column Guard (replaces 004 version; zero GUC or auth.uid() IS NULL bypass)
CREATE OR REPLACE FUNCTION public.guard_delivery_column_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor        UUID := auth.uid();
  v_role         TEXT := COALESCE(current_setting('role', true), 'none');
  v_trusted_role BOOLEAN := (
    v_role = 'service_role'
    OR (v_role = 'none' AND session_user IN ('postgres', 'supabase_admin'))
  );
  v_dispatch     BOOLEAN := orderflow_internal.has_capability(NEW.id, 'dispatch');
  v_pod_complete BOOLEAN := orderflow_internal.has_capability(NEW.id, 'pod_complete');
  v_pod_attempt  BOOLEAN := orderflow_internal.has_capability(NEW.id, 'pod_attempt');
  v_pod_reset    BOOLEAN := orderflow_internal.has_capability(NEW.id, 'pod_reset');
  v_verified_pay BOOLEAN := orderflow_internal.has_capability(NEW.id, 'verified_payment');
BEGIN
  -- Core identity & order specification columns are strictly immutable after creation.
  IF NEW.vendor_id IS DISTINCT FROM OLD.vendor_id
     OR NEW.tracking_code IS DISTINCT FROM OLD.tracking_code
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.require_photo_proof IS DISTINCT FROM OLD.require_photo_proof THEN
    RAISE EXCEPTION 'vendor_id, tracking_code, idempotency_key, created_at and require_photo_proof are immutable'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.provider_id IS DISTINCT FROM OLD.provider_id AND NOT v_dispatch AND NOT v_trusted_role THEN
    RAISE EXCEPTION 'provider_id can only be changed by the dispatch engine'
      USING ERRCODE = '42501';
  END IF;

  -- Capability-scoped column allowances:
  IF v_dispatch THEN
    IF (to_jsonb(NEW) - 'status' - 'provider_id' - 'updated_at')
       IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'provider_id' - 'updated_at') THEN
      RAISE EXCEPTION 'Dispatch capability may only update status and provider_id'
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_pod_complete THEN
    IF (to_jsonb(NEW) - 'status' - 'payment_status' - 'pod_photo_url' - 'pod_completed_at' - 'updated_at')
       IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'payment_status' - 'pod_photo_url' - 'pod_completed_at' - 'updated_at') THEN
      RAISE EXCEPTION 'POD completion capability may only update POD and COD payment fields'
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_pod_attempt OR v_pod_reset THEN
    IF (to_jsonb(NEW) - 'pod_failed_attempts' - 'updated_at')
       IS DISTINCT FROM (to_jsonb(OLD) - 'pod_failed_attempts' - 'updated_at') THEN
      RAISE EXCEPTION 'POD attempt/reset capability may only update pod_failed_attempts'
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_verified_pay THEN
    IF (to_jsonb(NEW) - 'payment_status' - 'updated_at')
       IS DISTINCT FROM (to_jsonb(OLD) - 'payment_status' - 'updated_at') THEN
      RAISE EXCEPTION 'Verified payment capability may only update payment_status'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NOT v_trusted_role THEN
    -- Ordinary authenticated RPC transitions (transition_delivery_status):
    IF v_role <> 'authenticated' OR v_actor IS NULL THEN
      RAISE EXCEPTION 'Authentication required to update delivery'
        USING ERRCODE = '42501';
    END IF;

    IF (to_jsonb(NEW) - 'status' - 'driver_id' - 'updated_at')
       IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'driver_id' - 'updated_at') THEN
      RAISE EXCEPTION 'Only status and driver_id may be updated outside specialized RPC capabilities'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Fleet ownership invariant for driver_id.
  IF NEW.driver_id IS NOT NULL AND NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.drivers dr
      WHERE dr.id = NEW.driver_id AND dr.provider_id = NEW.provider_id AND dr.is_active
    ) THEN
      RAISE EXCEPTION 'Driver does not belong to the assigned provider fleet'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_delivery_column_changes()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_guard_delivery_column_changes ON public.deliveries;
CREATE TRIGGER trg_guard_delivery_column_changes
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_delivery_column_changes();


-- 5d. Role-Aware Status State Machine (replaces 004 version; zero GUC or auth.uid() IS NULL bypass)
CREATE OR REPLACE FUNCTION public.validate_delivery_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor        UUID := auth.uid();
  v_role         TEXT := COALESCE(current_setting('role', true), 'none');
  v_trusted_role BOOLEAN := (
    v_role = 'service_role'
    OR (v_role = 'none' AND session_user IN ('postgres', 'supabase_admin'))
  );
  v_dispatch     BOOLEAN := orderflow_internal.has_capability(NEW.id, 'dispatch');
  v_pod_complete BOOLEAN := orderflow_internal.has_capability(NEW.id, 'pod_complete');
  v_notes        TEXT := NULLIF(left(btrim(COALESCE(current_setting('orderflow.transition_notes', true), '')), 500), '');
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'delivered' THEN
    RAISE EXCEPTION 'Cannot modify status of a delivery that is already delivered';
  END IF;

  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot modify status of a delivery that is cancelled';
  END IF;

  -- Transition matrix
  CASE OLD.status
    WHEN 'draft' THEN
      IF NEW.status NOT IN ('created', 'searching', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'created' THEN
      IF NEW.status NOT IN ('searching', 'opportunity_sent', 'provider_selected', 'awaiting_pickup', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'searching' THEN
      IF NEW.status NOT IN ('opportunity_sent', 'provider_selected', 'awaiting_pickup', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'opportunity_sent' THEN
      IF NEW.status NOT IN ('provider_selected', 'awaiting_pickup', 'searching', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'provider_selected' THEN
      IF NEW.status NOT IN ('awaiting_pickup', 'picked_up', 'in_transit', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'awaiting_pickup' THEN
      IF NEW.status NOT IN ('picked_up', 'in_transit', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'picked_up' THEN
      IF NEW.status NOT IN ('in_transit', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'in_transit' THEN
      IF NEW.status NOT IN ('delivered', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from % to %', OLD.status, NEW.status;
      END IF;
    ELSE
      RAISE EXCEPTION 'Unknown previous delivery status %', OLD.status;
  END CASE;

  -- Delivered ALWAYS requires pod_complete capability (even for service_role).
  IF NEW.status = 'delivered' AND NOT v_pod_complete THEN
    RAISE EXCEPTION 'Status delivered requires verified POD completion capability'
      USING ERRCODE = '42501';
  END IF;

  -- Actor authorization rules (enforced whenever not a trusted admin/service_role session)
  IF NOT v_trusted_role THEN
    IF NEW.status IN ('searching', 'opportunity_sent', 'provider_selected') THEN
      IF NOT v_dispatch THEN
        RAISE EXCEPTION 'Status % can only be set by the dispatch engine', NEW.status
          USING ERRCODE = '42501';
      END IF;

    ELSIF NEW.status IN ('awaiting_pickup', 'picked_up', 'in_transit', 'delivered') THEN
      IF v_role <> 'authenticated'
         OR v_actor IS NULL
         OR OLD.provider_id IS NULL
         OR v_actor IS DISTINCT FROM OLD.provider_id
         OR NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN
        RAISE EXCEPTION 'Only the assigned provider can move a delivery to %', NEW.status
          USING ERRCODE = '42501';
      END IF;

    ELSIF NEW.status = 'cancelled' THEN
      IF NOT v_dispatch THEN
        IF v_role <> 'authenticated'
           OR v_actor IS NULL
           OR v_actor IS DISTINCT FROM OLD.vendor_id THEN
          RAISE EXCEPTION 'Only the vendor can cancel a delivery'
            USING ERRCODE = '42501';
        END IF;
        IF OLD.status IN ('picked_up', 'in_transit') THEN
          RAISE EXCEPTION 'A delivery cannot be cancelled after pickup'
            USING ERRCODE = '42501';
        END IF;
      END IF;

    ELSIF NEW.status = 'created' THEN
      IF v_role <> 'authenticated'
         OR v_actor IS NULL
         OR v_actor IS DISTINCT FROM OLD.vendor_id THEN
        RAISE EXCEPTION 'Only the vendor can submit a draft delivery'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.delivery_status_history (
    delivery_id, previous_status, new_status, changed_by_user_id, notes
  ) VALUES (
    NEW.id,
    OLD.status,
    NEW.status,
    v_actor,
    COALESCE(v_notes, 'Status transitioned from ' || OLD.status || ' to ' || NEW.status)
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_delivery_status_transition()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validate_delivery_status_transition ON public.deliveries;
CREATE TRIGGER trg_validate_delivery_status_transition
  BEFORE UPDATE OF status ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_delivery_status_transition();


-- 5e. Burn-on-use capability consumer on deliveries (fires AFTER each row UPDATE)
CREATE OR REPLACE FUNCTION public.consume_delivery_capabilities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM orderflow_internal.trusted_capabilities
  WHERE txid = pg_current_xact_id()
    AND target_id = NEW.id
    AND capability IN ('dispatch', 'pod_attempt', 'pod_reset', 'pod_complete', 'verified_payment');
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_delivery_capabilities()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_z_consume_delivery_capabilities ON public.deliveries;
CREATE TRIGGER trg_z_consume_delivery_capabilities
  AFTER UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.consume_delivery_capabilities();


-- ============================================================================
-- 6. DISPATCH, CREATION, POD COMPLETION, ROTATION & TRACKING RPCS
-- ============================================================================

CREATE OR REPLACE FUNCTION public._advance_dispatch_queue(p_delivery_id UUID)
RETURNS public.delivery_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next    RECORD;
  v_current public.delivery_status;
BEGIN
  SELECT status INTO v_current FROM public.deliveries WHERE id = p_delivery_id;

  LOOP
    SELECT o.id, o.rank_order, COALESCE(pa.status, 'available') AS availability
    INTO v_next
    FROM public.dispatch_opportunities o
    LEFT JOIN public.provider_availability pa ON pa.provider_id = o.provider_id
    WHERE o.delivery_id = p_delivery_id
      AND o.status = 'queued'
    ORDER BY o.rank_order ASC
    LIMIT 1
    FOR UPDATE OF o;

    EXIT WHEN NOT FOUND;

    IF v_next.availability <> 'available' THEN
      UPDATE public.dispatch_opportunities
      SET status = 'skipped', responded_at = NOW()
      WHERE id = v_next.id;
      CONTINUE;
    END IF;

    UPDATE public.dispatch_opportunities
    SET status = 'sent', sent_at = NOW(), expires_at = NOW() + public._dispatch_offer_ttl()
    WHERE id = v_next.id;

    IF v_current IS DISTINCT FROM 'opportunity_sent' THEN
      PERFORM orderflow_internal.grant_capability(p_delivery_id, 'dispatch');
      PERFORM set_config('orderflow.transition_notes',
        'Dispatch offer sent to candidate rank ' || v_next.rank_order, true);
      UPDATE public.deliveries SET status = 'opportunity_sent' WHERE id = p_delivery_id;
      PERFORM set_config('orderflow.transition_notes', '', true);
    END IF;

    RETURN 'opportunity_sent';
  END LOOP;

  IF v_current IS DISTINCT FROM 'searching' THEN
    PERFORM orderflow_internal.grant_capability(p_delivery_id, 'dispatch');
    PERFORM set_config('orderflow.transition_notes',
      'Dispatch queue exhausted; delivery returned to open marketplace', true);
    UPDATE public.deliveries SET status = 'searching' WHERE id = p_delivery_id;
    PERFORM set_config('orderflow.transition_notes', '', true);
  END IF;

  RETURN 'searching';
END;
$$;

REVOKE ALL ON FUNCTION public._advance_dispatch_queue(UUID)
  FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public._delivery_creation_payload(p_delivery_id UUID, p_replay BOOLEAN)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'idempotent_replay', p_replay,
    'delivery_id', d.id,
    'tracking_code', d.tracking_code,
    'status', d.status,
    'provider_id', d.provider_id,
    'payment_method', d.payment_method,
    'payment_status', d.payment_status,
    'require_photo_proof', d.require_photo_proof,
    'pod_verification_code', s.pin_code,
    'recipient_tracking_token', s.recipient_token,
    'current_opportunity_provider_id', (
      SELECT o.provider_id FROM public.dispatch_opportunities o
      WHERE o.delivery_id = d.id AND o.status = 'sent'
      LIMIT 1
    ),
    'candidate_provider_ids', COALESCE((
      SELECT jsonb_agg(o.provider_id ORDER BY o.rank_order)
      FROM public.dispatch_opportunities o
      WHERE o.delivery_id = d.id
    ), '[]'::jsonb),
    'created_at', d.created_at,
    'updated_at', d.updated_at
  )
  FROM public.deliveries d
  LEFT JOIN public.delivery_pod_secrets s ON s.delivery_id = d.id
  WHERE d.id = p_delivery_id;
$$;

REVOKE ALL ON FUNCTION public._delivery_creation_payload(UUID, BOOLEAN)
  FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.accept_delivery_opportunity(
  p_delivery_id UUID,
  p_provider_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       UUID := auth.uid();
  v_delivery     RECORD;
  v_opp          RECORD;
  v_availability public.availability_status;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_authenticated',
      'error', 'Authentication required');
  END IF;

  IF p_provider_id IS DISTINCT FROM v_caller THEN
    RETURN jsonb_build_object('success', false, 'code', 'forbidden',
      'error', 'You can only accept deliveries on behalf of your own provider account');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.logistics_providers WHERE id = v_caller) THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_a_provider',
      'error', 'Only registered logistics providers can accept deliveries');
  END IF;

  SELECT * INTO v_delivery FROM public.deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_found',
      'error', 'Delivery not found');
  END IF;

  IF v_delivery.provider_id IS NOT NULL THEN
    IF v_delivery.provider_id = v_caller
       AND v_delivery.status NOT IN ('delivered', 'cancelled') THEN
      RETURN jsonb_build_object('success', true, 'already_accepted', true,
        'delivery_id', p_delivery_id, 'status', v_delivery.status);
    END IF;
    RETURN jsonb_build_object('success', false, 'code', 'already_assigned',
      'error', 'Delivery has already been assigned to another provider');
  END IF;

  SELECT * INTO v_opp
  FROM public.dispatch_opportunities
  WHERE delivery_id = p_delivery_id AND provider_id = v_caller
  FOR UPDATE;

  IF v_delivery.status = 'opportunity_sent' THEN
    IF v_opp.id IS NULL OR v_opp.status <> 'sent' THEN
      RETURN jsonb_build_object('success', false, 'code', 'no_active_offer',
        'error', 'This delivery is currently offered to another provider');
    END IF;

    IF v_opp.expires_at IS NOT NULL AND v_opp.expires_at <= NOW() THEN
      UPDATE public.dispatch_opportunities
      SET status = 'expired', responded_at = NOW()
      WHERE id = v_opp.id;
      PERFORM public._advance_dispatch_queue(p_delivery_id);
      RETURN jsonb_build_object('success', false, 'code', 'offer_expired',
        'error', 'This offer has expired');
    END IF;

  ELSIF v_delivery.status IN ('searching', 'created') THEN
    SELECT status INTO v_availability FROM public.provider_availability WHERE provider_id = v_caller;
    IF COALESCE(v_availability, 'available') <> 'available' THEN
      RETURN jsonb_build_object('success', false, 'code', 'provider_unavailable',
        'error', 'Set your availability to Available before claiming open deliveries');
    END IF;

  ELSE
    RETURN jsonb_build_object('success', false, 'code', 'not_available',
      'error', 'Delivery is no longer available (current status: ' || v_delivery.status || ')');
  END IF;

  PERFORM orderflow_internal.grant_capability(p_delivery_id, 'dispatch');
  PERFORM set_config('orderflow.transition_notes',
    CASE WHEN v_delivery.status = 'opportunity_sent'
      THEN 'Targeted dispatch offer accepted by provider'
      ELSE 'Open marketplace delivery claimed by provider' END, true);

  UPDATE public.deliveries
  SET provider_id = v_caller, status = 'provider_selected'
  WHERE id = p_delivery_id;

  IF v_opp.id IS NOT NULL THEN
    UPDATE public.dispatch_opportunities
    SET status = 'accepted', responded_at = NOW()
    WHERE id = v_opp.id;
  ELSE
    INSERT INTO public.dispatch_opportunities (delivery_id, provider_id, rank_order, status, sent_at, responded_at)
    VALUES (
      p_delivery_id, v_caller,
      COALESCE((SELECT MAX(rank_order) FROM public.dispatch_opportunities WHERE delivery_id = p_delivery_id), 0) + 1,
      'accepted', NOW(), NOW()
    );
  END IF;

  UPDATE public.dispatch_opportunities
  SET status = 'expired', responded_at = COALESCE(responded_at, NOW())
  WHERE delivery_id = p_delivery_id
    AND provider_id <> v_caller
    AND status IN ('queued', 'sent');

  PERFORM set_config('orderflow.transition_notes', '', true);

  RETURN jsonb_build_object('success', true, 'already_accepted', false,
    'delivery_id', p_delivery_id, 'status', 'provider_selected');
END;
$$;

REVOKE ALL ON FUNCTION public.accept_delivery_opportunity(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_delivery_opportunity(UUID, UUID) TO authenticated, service_role;


-- Status Transition RPC: rejects 'delivered' (must go through complete_delivery_with_pod).
CREATE OR REPLACE FUNCTION public.transition_delivery_status(
  p_delivery_id UUID,
  p_new_status public.delivery_status,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   UUID := auth.uid();
  v_delivery RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_authenticated',
      'error', 'Authentication required');
  END IF;

  SELECT * INTO v_delivery FROM public.deliveries WHERE id = p_delivery_id FOR UPDATE;

  IF NOT FOUND OR (v_caller IS DISTINCT FROM v_delivery.vendor_id
                   AND v_caller IS DISTINCT FROM v_delivery.provider_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_found',
      'error', 'Delivery not found');
  END IF;

  IF p_new_status IN ('draft', 'created', 'searching', 'opportunity_sent', 'provider_selected') THEN
    RETURN jsonb_build_object('success', false, 'code', 'use_dispatch_rpc',
      'error', 'Status ' || p_new_status || ' is managed by the dispatch engine');
  END IF;

  IF p_new_status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'code', 'pod_required',
      'error', 'Deliveries must be completed via complete_delivery_with_pod with the recipient 4-digit PIN');
  END IF;

  IF v_delivery.status = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true,
      'delivery_id', p_delivery_id, 'status', p_new_status);
  END IF;

  PERFORM set_config('orderflow.transition_notes', COALESCE(left(btrim(p_notes), 500), ''), true);

  BEGIN
    UPDATE public.deliveries SET status = p_new_status WHERE id = p_delivery_id;

    IF p_new_status = 'cancelled' THEN
      UPDATE public.dispatch_opportunities
      SET status = 'expired', responded_at = COALESCE(responded_at, NOW())
      WHERE delivery_id = p_delivery_id AND status IN ('queued', 'sent');

      UPDATE public.delivery_pod_secrets
      SET token_revoked_at = COALESCE(token_revoked_at, NOW())
      WHERE delivery_id = p_delivery_id;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM set_config('orderflow.transition_notes', '', true);
      RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'error', SQLERRM);
    WHEN raise_exception THEN
      PERFORM set_config('orderflow.transition_notes', '', true);
      RETURN jsonb_build_object('success', false, 'code', 'invalid_transition', 'error', SQLERRM);
  END;

  PERFORM set_config('orderflow.transition_notes', '', true);

  RETURN jsonb_build_object('success', true, 'unchanged', false,
    'delivery_id', p_delivery_id, 'status', p_new_status);
END;
$$;

REVOKE ALL ON FUNCTION public.transition_delivery_status(UUID, public.delivery_status, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_delivery_status(UUID, public.delivery_status, TEXT)
  TO authenticated, service_role;


-- Drop 26-arg signature from migration 004 before creating 28-arg signature to prevent overload ambiguity.
DROP FUNCTION IF EXISTS public.create_delivery_transactional(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, public.dispatch_mode_enum, TEXT, TEXT,
  public.package_type_enum, NUMERIC, INTEGER, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID[], TEXT
);

CREATE OR REPLACE FUNCTION public.create_delivery_transactional(
  p_pickup_address TEXT,
  p_pickup_city TEXT,
  p_destination_address TEXT,
  p_destination_city TEXT,
  p_recipient_name TEXT,
  p_recipient_phone TEXT,
  p_estimated_price NUMERIC,
  p_dispatch_mode public.dispatch_mode_enum,
  p_product_name TEXT,
  p_item_category TEXT,
  p_package_type public.package_type_enum,
  p_weight_kg NUMERIC,
  p_quantity INTEGER DEFAULT 1,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL,
  p_is_fragile BOOLEAN DEFAULT FALSE,
  p_image_url TEXT DEFAULT NULL,
  p_special_instructions TEXT DEFAULT NULL,
  p_pickup_contact_name TEXT DEFAULT NULL,
  p_pickup_contact_phone TEXT DEFAULT NULL,
  p_delivery_notes TEXT DEFAULT NULL,
  p_estimated_delivery_time TEXT DEFAULT NULL,
  p_selected_provider_id UUID DEFAULT NULL,
  p_candidate_provider_ids UUID[] DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_payment_method public.payment_method_enum DEFAULT 'cash_on_delivery',
  p_require_photo_proof BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller         UUID := auth.uid();
  v_existing_id    UUID;
  v_delivery_id    UUID;
  v_code           TEXT;
  v_constraint     TEXT;
  v_key            TEXT := NULLIF(btrim(p_idempotency_key), '');
  v_status         public.delivery_status;
  v_provider       UUID;
  v_candidates     UUID[];
  v_availability   public.availability_status;
  v_payment_method public.payment_method_enum := COALESCE(p_payment_method, 'cash_on_delivery');
  v_attempt        INT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE id = v_caller) THEN
    RAISE EXCEPTION 'Only registered vendors can create deliveries' USING ERRCODE = '42501';
  END IF;

  IF v_payment_method = 'prepaid_online' THEN
    RAISE EXCEPTION 'Online prepaid payment is unavailable until verified payment gateway integration is enabled'
      USING ERRCODE = '22023';
  END IF;

  IF v_key IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.deliveries
    WHERE vendor_id = v_caller AND idempotency_key = v_key;
    IF FOUND THEN
      RETURN public._delivery_creation_payload(v_existing_id, true);
    END IF;
  END IF;

  IF NULLIF(btrim(p_pickup_address), '') IS NULL
     OR NULLIF(btrim(p_pickup_city), '') IS NULL
     OR NULLIF(btrim(p_destination_address), '') IS NULL
     OR NULLIF(btrim(p_destination_city), '') IS NULL
     OR NULLIF(btrim(p_recipient_name), '') IS NULL
     OR NULLIF(btrim(p_recipient_phone), '') IS NULL
     OR NULLIF(btrim(p_product_name), '') IS NULL
     OR NULLIF(btrim(p_item_category), '') IS NULL THEN
    RAISE EXCEPTION 'Missing required delivery fields' USING ERRCODE = '22023';
  END IF;

  IF p_dispatch_mode = 'manual' THEN
    IF p_selected_provider_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.logistics_providers WHERE id = p_selected_provider_id) THEN
      RAISE EXCEPTION 'Manual dispatch requires a valid selected provider' USING ERRCODE = '22023';
    END IF;
    SELECT status INTO v_availability FROM public.provider_availability WHERE provider_id = p_selected_provider_id;
    IF COALESCE(v_availability, 'available') = 'unavailable' THEN
      RAISE EXCEPTION 'Selected provider is currently unavailable' USING ERRCODE = '22023';
    END IF;
    v_provider := p_selected_provider_id;
    v_status := 'awaiting_pickup';
  ELSE
    SELECT COALESCE(array_agg(c.pid ORDER BY c.first_pos), '{}')
    INTO v_candidates
    FROM (
      SELECT u.pid, MIN(u.pos) AS first_pos
      FROM unnest(COALESCE(p_candidate_provider_ids, '{}'::UUID[])) WITH ORDINALITY AS u(pid, pos)
      JOIN public.logistics_providers lp ON lp.id = u.pid
      GROUP BY u.pid
    ) c;
    v_provider := NULL;
    v_status := 'searching';
  END IF;

  FOR v_attempt IN 1..5 LOOP
    v_code := public._generate_tracking_code();
    BEGIN
      INSERT INTO public.deliveries (
        tracking_code, vendor_id, provider_id, status, dispatch_mode,
        pickup_address, pickup_city, pickup_contact_name, pickup_contact_phone,
        destination_address, destination_city, recipient_name, recipient_phone,
        delivery_notes, estimated_price, estimated_delivery_time, idempotency_key,
        payment_method, payment_status, require_photo_proof
      ) VALUES (
        v_code, v_caller, v_provider, v_status, p_dispatch_mode,
        btrim(p_pickup_address), btrim(p_pickup_city),
        NULLIF(btrim(p_pickup_contact_name), ''), NULLIF(btrim(p_pickup_contact_phone), ''),
        btrim(p_destination_address), btrim(p_destination_city),
        btrim(p_recipient_name), btrim(p_recipient_phone),
        NULLIF(btrim(p_delivery_notes), ''), p_estimated_price,
        COALESCE(NULLIF(btrim(p_estimated_delivery_time), ''), 'Same Day'), v_key,
        v_payment_method, 'pending'::public.payment_status_enum, COALESCE(p_require_photo_proof, FALSE)
      )
      RETURNING id INTO v_delivery_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint = 'uq_deliveries_vendor_idempotency' THEN
        SELECT id INTO v_existing_id FROM public.deliveries
        WHERE vendor_id = v_caller AND idempotency_key = v_key;
        RETURN public._delivery_creation_payload(v_existing_id, true);
      ELSIF v_constraint = 'deliveries_tracking_code_key' AND v_attempt < 5 THEN
        CONTINUE;
      ELSE
        RAISE;
      END IF;
    END;
  END LOOP;

  INSERT INTO public.package_details (
    delivery_id, product_name, item_category, package_type, quantity, weight_kg,
    length_cm, width_cm, height_cm, is_fragile, image_url, special_instructions
  ) VALUES (
    v_delivery_id, btrim(p_product_name), btrim(p_item_category), p_package_type,
    COALESCE(p_quantity, 1), p_weight_kg,
    p_length_cm, p_width_cm, p_height_cm, COALESCE(p_is_fragile, FALSE),
    NULLIF(btrim(p_image_url), ''), NULLIF(btrim(p_special_instructions), '')
  );

  INSERT INTO public.delivery_pod_secrets (
    delivery_id, pin_code, recipient_token, token_expires_at
  ) VALUES (
    v_delivery_id,
    orderflow_internal.generate_pod_pin(),
    orderflow_internal.generate_recipient_token(),
    NOW() + INTERVAL '7 days'
  );

  INSERT INTO public.delivery_status_history (delivery_id, previous_status, new_status, changed_by_user_id, notes)
  VALUES (v_delivery_id, NULL, v_status, v_caller, 'Delivery order created');

  IF p_dispatch_mode = 'auto' AND cardinality(v_candidates) > 0 THEN
    INSERT INTO public.dispatch_opportunities (delivery_id, provider_id, rank_order, status)
    SELECT v_delivery_id, c.pid, c.pos::INT, 'queued'
    FROM unnest(v_candidates) WITH ORDINALITY AS c(pid, pos);

    PERFORM public._advance_dispatch_queue(v_delivery_id);
  END IF;

  RETURN public._delivery_creation_payload(v_delivery_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.create_delivery_transactional(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, public.dispatch_mode_enum, TEXT, TEXT,
  public.package_type_enum, NUMERIC, INTEGER, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID[], TEXT, public.payment_method_enum, BOOLEAN
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_delivery_transactional(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, public.dispatch_mode_enum, TEXT, TEXT,
  public.package_type_enum, NUMERIC, INTEGER, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID[], TEXT, public.payment_method_enum, BOOLEAN
) TO authenticated, service_role;


-- Atomic Proof-of-Delivery Completion RPC (no client bypass, 5-attempt lockout)
CREATE OR REPLACE FUNCTION public.complete_delivery_with_pod(
  p_delivery_id UUID,
  p_verification_code TEXT,
  p_photo_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller         UUID := auth.uid();
  v_delivery       RECORD;
  v_secret         RECORD;
  v_clean_code     TEXT := btrim(COALESCE(p_verification_code, ''));
  v_clean_photo    TEXT := NULLIF(btrim(COALESCE(p_photo_url, '')), '');
  v_new_attempts   INTEGER;
  v_completed_at   TIMESTAMPTZ := NOW();
  v_new_pay_status public.payment_status_enum;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_authenticated',
      'error', 'Authentication required');
  END IF;

  SELECT * INTO v_delivery FROM public.deliveries WHERE id = p_delivery_id FOR UPDATE;

  IF NOT FOUND OR (v_caller IS DISTINCT FROM v_delivery.provider_id
                   AND v_caller IS DISTINCT FROM v_delivery.vendor_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_found',
      'error', 'Delivery not found');
  END IF;

  IF v_caller IS DISTINCT FROM v_delivery.provider_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'forbidden',
      'error', 'Only the assigned logistics provider can complete handover');
  END IF;

  IF v_delivery.status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'code', 'already_delivered',
      'error', 'Delivery has already been marked as delivered');
  END IF;

  IF v_delivery.status <> 'in_transit' THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_transition',
      'error', 'Delivery must be in_transit before completing handover (current status: ' || v_delivery.status || ')');
  END IF;

  IF v_delivery.pod_failed_attempts >= 5 THEN
    RETURN jsonb_build_object('success', false, 'code', 'too_many_attempts',
      'error', 'Too many failed PIN attempts. Ask the vendor to rotate the handover PIN.');
  END IF;

  SELECT * INTO v_secret FROM public.delivery_pod_secrets WHERE delivery_id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'pod_secret_missing',
      'error', 'Handover verification secret is unavailable for this delivery');
  END IF;

  IF v_clean_code !~ '^[1-9][0-9]{3}$'
     OR pg_catalog.sha256(convert_to(v_secret.pin_code, 'UTF8'))
        IS DISTINCT FROM pg_catalog.sha256(convert_to(v_clean_code, 'UTF8')) THEN
    v_new_attempts := v_delivery.pod_failed_attempts + 1;

    BEGIN
      PERFORM orderflow_internal.grant_capability(p_delivery_id, 'pod_attempt');
      UPDATE public.deliveries
      SET pod_failed_attempts = v_new_attempts
      WHERE id = p_delivery_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE;
    END;

    RETURN jsonb_build_object(
      'success', false,
      'code', CASE WHEN v_new_attempts >= 5 THEN 'too_many_attempts' ELSE 'invalid_pin' END,
      'attempts_remaining', GREATEST(0, 5 - v_new_attempts),
      'error', CASE
        WHEN v_new_attempts >= 5
          THEN 'Too many failed PIN attempts. Ask the vendor to rotate the handover PIN.'
        ELSE 'Invalid 4-digit verification code. Please request the code from the recipient.'
      END
    );
  END IF;

  IF v_delivery.require_photo_proof AND v_clean_photo IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'photo_required',
      'error', 'Vendor has required photo proof of delivery. Please capture or upload a handover photo.');
  END IF;

  IF v_clean_photo IS NOT NULL THEN
    IF octet_length(v_clean_photo) > 2097152
       OR v_clean_photo !~ '^(https://[[:graph:]]+|data:image/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+)$' THEN
      RETURN jsonb_build_object('success', false, 'code', 'invalid_photo_url',
        'error', 'Invalid or oversized proof-of-delivery photo.');
    END IF;
  END IF;

  v_new_pay_status := CASE
    WHEN v_delivery.payment_method = 'cash_on_delivery' AND v_delivery.payment_status = 'pending'
      THEN 'collected'::public.payment_status_enum
    ELSE v_delivery.payment_status
  END;

  BEGIN
    PERFORM orderflow_internal.grant_capability(p_delivery_id, 'pod_complete');
    PERFORM set_config('orderflow.transition_notes',
      COALESCE(NULLIF(left(btrim(COALESCE(p_notes, '')), 500), ''), 'Completed with verified recipient PIN'),
      true);

    UPDATE public.deliveries
    SET status = 'delivered',
        payment_status = v_new_pay_status,
        pod_photo_url = v_clean_photo,
        pod_completed_at = v_completed_at
    WHERE id = p_delivery_id;

    PERFORM set_config('orderflow.transition_notes', '', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('orderflow.transition_notes', '', true);
    RETURN jsonb_build_object('success', false, 'code', 'completion_failed', 'error', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'success', true,
    'delivery_id', p_delivery_id,
    'status', 'delivered',
    'payment_status', v_new_pay_status,
    'pod_completed_at', v_completed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_delivery_with_pod(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_delivery_with_pod(UUID, TEXT, TEXT, TEXT)
  TO authenticated, service_role;


-- Vendor POD Secret Rotation & Lockout Reset RPC
CREATE OR REPLACE FUNCTION public.rotate_delivery_pod_secrets(
  p_delivery_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller    UUID := auth.uid();
  v_delivery  RECORD;
  v_new_pin   TEXT;
  v_new_token TEXT;
  v_expires   TIMESTAMPTZ := NOW() + INTERVAL '7 days';
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_authenticated',
      'error', 'Authentication required');
  END IF;

  SELECT * INTO v_delivery FROM public.deliveries WHERE id = p_delivery_id FOR UPDATE;

  IF NOT FOUND OR v_caller IS DISTINCT FROM v_delivery.vendor_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_found',
      'error', 'Delivery not found');
  END IF;

  IF v_delivery.status IN ('delivered', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'code', 'terminal_delivery',
      'error', 'Cannot rotate handover secrets for a delivered or cancelled order');
  END IF;

  v_new_pin := orderflow_internal.generate_pod_pin();
  v_new_token := orderflow_internal.generate_recipient_token();

  INSERT INTO public.delivery_pod_secrets (
    delivery_id, pin_code, recipient_token, token_expires_at, token_revoked_at
  ) VALUES (
    p_delivery_id, v_new_pin, v_new_token, v_expires, NULL
  )
  ON CONFLICT (delivery_id) DO UPDATE
  SET pin_code = EXCLUDED.pin_code,
      recipient_token = EXCLUDED.recipient_token,
      token_expires_at = EXCLUDED.token_expires_at,
      token_revoked_at = NULL;

  IF v_delivery.pod_failed_attempts > 0 THEN
    PERFORM orderflow_internal.grant_capability(p_delivery_id, 'pod_reset');
    UPDATE public.deliveries
    SET pod_failed_attempts = 0
    WHERE id = p_delivery_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'delivery_id', p_delivery_id,
    'pod_verification_code', v_new_pin,
    'recipient_tracking_token', v_new_token,
    'token_expires_at', v_expires
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_delivery_pod_secrets(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_delivery_pod_secrets(UUID) TO authenticated, service_role;


-- Public Tracking View (strictly the 9 non-sensitive milestone columns)
CREATE OR REPLACE VIEW public.public_tracking_view
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
FROM public.deliveries d
JOIN public.package_details p ON p.delivery_id = d.id
JOIN public.vendors v ON v.id = d.vendor_id
LEFT JOIN public.logistics_providers lp ON lp.id = d.provider_id;


-- Public Tracking RPC with Case A / B / C Disclosure Enforcement
DROP FUNCTION IF EXISTS public.get_public_tracking(TEXT);
DROP FUNCTION IF EXISTS public.get_public_tracking(TEXT, TEXT);

CREATE FUNCTION public.get_public_tracking(
  p_tracking_code TEXT,
  p_recipient_token TEXT DEFAULT NULL
)
RETURNS TABLE (
  tracking_code TEXT,
  status public.delivery_status,
  estimated_delivery_time TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  product_name TEXT,
  vendor_name TEXT,
  provider_name TEXT,
  provider_logo_url TEXT,
  recipient_access_granted BOOLEAN,
  payment_method public.payment_method_enum,
  payment_status public.payment_status_enum,
  amount_due NUMERIC,
  require_photo_proof BOOLEAN,
  has_photo_proof BOOLEAN,
  pod_photo_url TEXT,
  pod_verification_code TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_code  TEXT := NULLIF(btrim(COALESCE(p_tracking_code, '')), '');
  v_clean_token TEXT := lower(btrim(COALESCE(p_recipient_token, '')));
BEGIN
  IF v_clean_code IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH target AS (
    SELECT
      d.id,
      d.tracking_code,
      d.status,
      d.estimated_delivery_time,
      d.estimated_price,
      d.payment_method,
      d.payment_status,
      d.require_photo_proof,
      d.pod_photo_url,
      d.created_at,
      d.updated_at,
      p.product_name,
      v.business_name AS vendor_name,
      lp.provider_name,
      lp.logo_url AS provider_logo_url,
      s.pin_code,
      (
        s.recipient_token IS NOT NULL
        AND v_clean_token ~ '^[0-9a-f]{64}$'
        AND s.token_revoked_at IS NULL
        AND s.token_expires_at > NOW()
        AND d.status <> 'cancelled'
        AND pg_catalog.sha256(convert_to(s.recipient_token, 'UTF8'))
            = pg_catalog.sha256(convert_to(v_clean_token, 'UTF8'))
      ) AS is_authorized
    FROM public.deliveries d
    JOIN public.package_details p ON p.delivery_id = d.id
    JOIN public.vendors v ON v.id = d.vendor_id
    LEFT JOIN public.logistics_providers lp ON lp.id = d.provider_id
    LEFT JOIN public.delivery_pod_secrets s ON s.delivery_id = d.id
    WHERE lower(d.tracking_code) = lower(v_clean_code)
    LIMIT 1
  )
  SELECT
    t.tracking_code,
    t.status,
    t.estimated_delivery_time,
    t.created_at,
    t.updated_at,
    t.product_name,
    t.vendor_name,
    t.provider_name,
    t.provider_logo_url,
    COALESCE(t.is_authorized, FALSE) AS recipient_access_granted,
    CASE WHEN t.is_authorized THEN t.payment_method ELSE NULL END,
    CASE WHEN t.is_authorized THEN t.payment_status ELSE NULL END,
    CASE
      WHEN t.is_authorized
           AND t.payment_method = 'cash_on_delivery'
           AND t.payment_status = 'pending'
           AND t.status <> 'delivered'
        THEN t.estimated_price
      ELSE NULL
    END AS amount_due,
    CASE WHEN t.is_authorized THEN t.require_photo_proof ELSE NULL END,
    CASE WHEN t.is_authorized THEN (t.pod_photo_url IS NOT NULL) ELSE NULL END,
    CASE
      WHEN t.is_authorized AND t.status = 'delivered' THEN t.pod_photo_url
      ELSE NULL
    END AS pod_photo_url,
    CASE
      WHEN t.is_authorized AND t.status NOT IN ('delivered', 'cancelled') THEN t.pin_code
      ELSE NULL
    END AS pod_verification_code
  FROM target t;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_tracking(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tracking(TEXT, TEXT) TO anon, authenticated, service_role;

-- Ensure consistent explicit privilege matrix on remaining 004 RPCs
REVOKE ALL ON FUNCTION public.decline_delivery_opportunity(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_delivery_opportunity(UUID, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_marketplace_opportunities(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_marketplace_opportunities(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.expire_stale_dispatch_opportunities() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_dispatch_opportunities() TO service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
