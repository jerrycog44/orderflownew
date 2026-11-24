-- ============================================================================
-- OrderFlow Migration 005 Real PostgreSQL 15+ Security & Role Verification
-- ============================================================================
-- Executes against a real PostgreSQL 15+ server (never relying on superuser
-- bypasses) by switching into `authenticator` -> `anon` / `authenticated`
-- and testing:
--   1. Legacy NULL payment preservation & active POD secret backfill
--   2. Duplicate Nigerian phone normalization & check constraint
--   3. Private `orderflow_internal` isolation from `anon` & `authenticated`
--   4. Custom GUC spoofing immunity (`orderflow.dispatch_context`, etc.)
--   5. Nested `SECURITY DEFINER` immunity on `guard_provider_reputation`
--   6. Table ACL revocations (`deliveries`, `delivery_pod_secrets`, etc.)
--   7. Payment integrity (`prepaid_online` disabled, COD vs `pay_at_pickup`)
--   8. POD `'0000'` rejection, 5-attempt lockout, secret rotation & completion
--   9. Public tracking Case A / Case B / Case C exact disclosure boundaries
--  10. `search_path = public` pinning across all functions in `public`
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Post-Migration Historical Data, Backfill, Phone & Function Audit (Owner)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_hist_pm public.payment_method_enum;
  v_hist_ps public.payment_status_enum;
  v_hist_secret_count INT;
  v_actv_pm public.payment_method_enum;
  v_actv_ps public.payment_status_enum;
  v_actv_pin TEXT;
  v_actv_tok TEXT;
  v_dup1_phone TEXT;
  v_dup2_phone TEXT;
  v_unpinned_funcs TEXT;
BEGIN
  -- 1a. Historical delivered order keeps NULL payment columns & no unnecessary secret row
  SELECT payment_method, payment_status INTO v_hist_pm, v_hist_ps
  FROM public.deliveries WHERE id = '00000000-0000-4000-8000-000000000901';

  IF v_hist_pm IS NOT NULL OR v_hist_ps IS NOT NULL THEN
    RAISE EXCEPTION 'TEST FAIL: Historical delivery payment fields were overwritten (% / %)', v_hist_pm, v_hist_ps;
  END IF;

  SELECT COUNT(*) INTO v_hist_secret_count
  FROM public.delivery_pod_secrets WHERE delivery_id = '00000000-0000-4000-8000-000000000901';

  IF v_hist_secret_count <> 0 THEN
    RAISE EXCEPTION 'TEST FAIL: Terminal historical delivery unexpectedly received POD secrets';
  END IF;

  -- 1b. Active pre-005 order keeps NULL payment columns AND receives valid CSPRNG POD secrets
  SELECT payment_method, payment_status INTO v_actv_pm, v_actv_ps
  FROM public.deliveries WHERE id = '00000000-0000-4000-8000-000000000902';

  IF v_actv_pm IS NOT NULL OR v_actv_ps IS NOT NULL THEN
    RAISE EXCEPTION 'TEST FAIL: Pre-005 active delivery payment fields were overwritten';
  END IF;

  SELECT pin_code, recipient_token INTO v_actv_pin, v_actv_tok
  FROM public.delivery_pod_secrets WHERE delivery_id = '00000000-0000-4000-8000-000000000902';

  IF v_actv_pin IS NULL OR v_actv_pin !~ '^[1-9][0-9]{3}$' OR v_actv_tok !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'TEST FAIL: Active pre-005 delivery did not receive valid POD secret backfill';
  END IF;

  -- 1c. Duplicate formatted phone normalization kept older profile & nulled newer duplicate
  SELECT phone INTO v_dup1_phone FROM public.profiles WHERE id = '00000000-0000-4000-8000-0000000000d1';
  SELECT phone INTO v_dup2_phone FROM public.profiles WHERE id = '00000000-0000-4000-8000-0000000000d2';

  IF v_dup1_phone <> '+2348099998888' OR v_dup2_phone IS NOT NULL THEN
    RAISE EXCEPTION 'TEST FAIL: Duplicate phone normalization mismatch (% vs %)', v_dup1_phone, v_dup2_phone;
  END IF;

  -- 1d. Dropped helper `has_active_dispatch_opportunity` must not exist
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_active_dispatch_opportunity'
  ) THEN
    RAISE EXCEPTION 'TEST FAIL: has_active_dispatch_opportunity still exists';
  END IF;

  -- 1e. Every function in `public` must have `search_path=public` pinned
  SELECT string_agg(p.proname, ', ') INTO v_unpinned_funcs
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proconfig IS NULL OR NOT ('search_path=public' = ANY(p.proconfig)));

  IF v_unpinned_funcs IS NOT NULL THEN
    RAISE EXCEPTION 'TEST FAIL: Functions in public missing pinned search_path=public: %', v_unpinned_funcs;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Nested SECURITY DEFINER Regression Test Setup (Temporary Helper Function)
-- ----------------------------------------------------------------------------
-- Simulates an accidental future SECURITY DEFINER RPC owned by `postgres`
-- that updates `logistics_providers` WITHOUT granting `provider_reputation`
-- in `orderflow_internal.trusted_capabilities`. Even though `current_user`
-- inside the trigger becomes `postgres`, `guard_provider_reputation()` MUST
-- still block rating/review_count tampering!
CREATE OR REPLACE FUNCTION public.__test_untrusted_secdef_provider_bump(p_provider_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.logistics_providers
  SET rating = 5.00,
      review_count = 99999
  WHERE id = p_provider_id;
END;
$$;

REVOKE ALL ON FUNCTION public.__test_untrusted_secdef_provider_bump(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__test_untrusted_secdef_provider_bump(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Non-Superuser Role Security & Behavioural Verification
-- ----------------------------------------------------------------------------
BEGIN;

SET LOCAL ROLE authenticator;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_blocked BOOLEAN;
BEGIN
  -- 3a. Private schema `orderflow_internal` is completely unreachable
  v_blocked := false;
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM orderflow_internal.trusted_capabilities';
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'SECURITY FAIL: authenticated accessed orderflow_internal.trusted_capabilities';
  END IF;

  -- 3b. Custom GUC spoofing + direct UPDATE on deliveries is blocked
  PERFORM set_config('orderflow.dispatch_context', 'true', true);
  PERFORM set_config('orderflow.verified_payment_webhook', 'true', true);

  v_blocked := false;
  BEGIN
    UPDATE public.deliveries
    SET status = 'delivered'
    WHERE id = '00000000-0000-4000-8000-000000000902';
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'SECURITY FAIL: authenticated updated public.deliveries directly';
  END IF;

  -- 3c. Direct provider reputation self-upgrade is blocked
  v_blocked := false;
  BEGIN
    UPDATE public.logistics_providers
    SET rating = 5.00, review_count = 5000
    WHERE id = '00000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'SECURITY FAIL: provider directly modified rating/review_count';
  END IF;

  -- 3d. Nested SECURITY DEFINER reputation bypass is ALSO blocked!
  v_blocked := false;
  BEGIN
    PERFORM public.__test_untrusted_secdef_provider_bump('00000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Provider reputation metrics%' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'SECURITY FAIL: Nested SECURITY DEFINER bypassed guard_provider_reputation()!';
  END IF;

  -- 3e. Provider CANNOT read `delivery_pod_secrets` via RLS even on assigned delivery
  IF EXISTS (
    SELECT 1 FROM public.delivery_pod_secrets
    WHERE delivery_id = '00000000-0000-4000-8000-000000000902'
  ) THEN
    RAISE EXCEPTION 'SECURITY FAIL: Assigned provider read delivery_pod_secrets directly!';
  END IF;
END;
$$;

COMMIT;

-- Drop temporary nested SECURITY DEFINER test helper
DROP FUNCTION public.__test_untrusted_secdef_provider_bump(UUID);

-- ----------------------------------------------------------------------------
-- 4. End-to-End Vendor Creation, Payment Integrity, POD Lockout, Rotation & Case A/B/C Tracking
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_blocked BOOLEAN;
  v_cod_create JSONB;
  v_cod_id UUID;
  v_cod_code TEXT;
  v_cod_pin TEXT;
  v_cod_token TEXT;
  v_pap_create JSONB;
  v_pap_id UUID;
  v_pap_pin TEXT;
  v_pod_res JSONB;
  v_rot_res JSONB;
  v_new_pin TEXT;
  v_new_token TEXT;
  v_accept_res JSONB;
  v_track_a RECORD;
  v_track_b RECORD;
  v_track_c RECORD;
  v_track_post RECORD;
  v_pm public.payment_method_enum;
  v_ps public.payment_status_enum;
  i INT;
BEGIN
  -- Switch into non-superuser `authenticated` as Vendor Alpha
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);

  -- 4a. `prepaid_online` MUST be rejected at creation
  v_blocked := false;
  BEGIN
    PERFORM public.create_delivery_transactional(
      'OF-PRE999', '00000000-0000-4000-8000-00000000000a', NULL,
      '12 Bodija', 'Ibadan', '45 Ring Rd', 'Ibadan',
      'Buyer', '+2348031234567', 'pending', 'manual', 3000, 'Today',
      'Laptop', 'Electronics', 'box', 1, 2.0, 30, 20, 10, true, NULL, NULL,
      '00000000-0000-4000-8000-00000000000a', NULL,
      'prepaid_online'::public.payment_method_enum, false
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Online prepayment is currently unavailable%' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'SECURITY FAIL: create_delivery_transactional allowed prepaid_online';
  END IF;

  -- 4b. Create valid Cash on Delivery order (auto-dispatch to Rider 1) requiring photo proof
  v_cod_create := public.create_delivery_transactional(
    'OF-COD100', '00000000-0000-4000-8000-00000000000a', NULL,
    '12 Bodija Market', 'Ibadan', '45 Ring Road', 'Ibadan',
    'Dr. Kunle', '+2348031234567', 'opportunity_sent', 'auto', 3500, 'Today 5PM',
    'Inverter Battery', 'Electronics', 'box', 1, 8.0, 35, 25, 25, true, NULL, NULL,
    '00000000-0000-4000-8000-00000000000a',
    ARRAY['00000000-0000-4000-8000-000000000001'::uuid],
    'cash_on_delivery'::public.payment_method_enum, true
  );

  v_cod_id := (v_cod_create ->> 'id')::uuid;
  v_cod_code := v_cod_create ->> 'tracking_code';
  v_cod_pin := v_cod_create ->> 'pod_verification_code';
  v_cod_token := v_cod_create ->> 'recipient_tracking_token';

  IF v_cod_pin !~ '^[1-9][0-9]{3}$' OR v_cod_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'SECURITY FAIL: Invalid CSPRNG secrets returned on COD creation';
  END IF;

  -- Also create a `pay_at_pickup` order to verify payment_status remains `pending` after POD
  v_pap_create := public.create_delivery_transactional(
    'OF-PAP200', '00000000-0000-4000-8000-00000000000a', NULL,
    '12 Bodija Market', 'Ibadan', '88 Challenge', 'Ibadan',
    'Engr. Tunde', '+2348039876543', 'opportunity_sent', 'auto', 2800, 'Today 6PM',
    'Spare Parts', 'Automotive', 'box', 1, 3.0, 20, 20, 15, false, NULL, NULL,
    '00000000-0000-4000-8000-00000000000a',
    ARRAY['00000000-0000-4000-8000-000000000002'::uuid],
    'pay_at_pickup'::public.payment_method_enum, false
  );
  v_pap_id := (v_pap_create ->> 'id')::uuid;
  v_pap_pin := v_pap_create ->> 'pod_verification_code';

  -- Switch to Rider 1 (`00000000-0000-4000-8000-000000000001`) to accept & advance COD delivery
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  v_accept_res := public.accept_delivery_opportunity(v_cod_id, '00000000-0000-4000-8000-000000000001');
  IF NOT (v_accept_res ->> 'success')::boolean THEN
    RAISE EXCEPTION 'TEST FAIL: Rider 1 could not accept COD opportunity: %', v_accept_res;
  END IF;

  PERFORM public.transition_delivery_status(v_cod_id, 'picked_up');
  PERFORM public.transition_delivery_status(v_cod_id, 'in_transit');

  -- Direct transition to `delivered` via `transition_delivery_status` MUST fail (`requires_pod`)
  v_pod_res := public.transition_delivery_status(v_cod_id, 'delivered');
  IF (v_pod_res ->> 'success')::boolean OR (v_pod_res ->> 'code') <> 'requires_pod' THEN
    RAISE EXCEPTION 'SECURITY FAIL: transition_delivery_status bypassed POD requirement: %', v_pod_res;
  END IF;

  -- Switch to `anon` to test Public Tracking Case A, Case B, and Case C BEFORE completion
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- Case A: Tracking code only
  SELECT * INTO v_track_a FROM public.get_public_tracking(v_cod_code, NULL);
  IF v_track_a.tracking_code <> v_cod_code
     OR v_track_a.pod_verification_code IS NOT NULL
     OR v_track_a.amount_due IS NOT NULL
     OR v_track_a.payment_method IS NOT NULL
     OR v_track_a.payment_status IS NOT NULL
     OR v_track_a.pod_photo_url IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY FAIL: Case A leaked sensitive recipient fields: %', row_to_json(v_track_a);
  END IF;

  -- Case C: Invalid token
  SELECT * INTO v_track_c FROM public.get_public_tracking(v_cod_code, repeat('f', 64));
  IF v_track_c.tracking_code <> v_cod_code
     OR v_track_c.pod_verification_code IS NOT NULL
     OR v_track_c.amount_due IS NOT NULL
     OR v_track_c.payment_method IS NOT NULL
     OR v_track_c.payment_status IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY FAIL: Case C leaked sensitive recipient fields on wrong token';
  END IF;

  -- Case B: Valid recipient token while active (`in_transit`)
  SELECT * INTO v_track_b FROM public.get_public_tracking(v_cod_code, v_cod_token);
  IF v_track_b.pod_verification_code <> v_cod_pin
     OR v_track_b.amount_due <> 3500
     OR v_track_b.payment_method <> 'cash_on_delivery'
     OR v_track_b.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'TEST FAIL: Case B did not return expected PIN/COD info to valid token holder: %', row_to_json(v_track_b);
  END IF;

  -- Switch back to Rider 1 (`authenticated`) to test `'0000'` rejection & 5-attempt lockout
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

  -- Attempt 1: Hardcoded `'0000'` bypass MUST be rejected as `invalid_pin_format` or `invalid_pin`
  v_pod_res := public.complete_delivery_with_pod(v_cod_id, '0000', 'https://cdn.orderflow.ng/pod1.jpg');
  IF (v_pod_res ->> 'success')::boolean THEN
    RAISE EXCEPTION 'SECURITY FAIL: Hardcoded 0000 PIN succeeded!';
  END IF;

  -- Exhaust 5 wrong 4-digit guesses (`1111` or `2222` distinct from `v_cod_pin`)
  FOR i IN 1..5 LOOP
    v_pod_res := public.complete_delivery_with_pod(
      v_cod_id,
      CASE WHEN v_cod_pin = '1111' THEN '2222' ELSE '1111' END,
      'https://cdn.orderflow.ng/pod1.jpg'
    );
  END LOOP;

  IF (v_pod_res ->> 'code') <> 'too_many_attempts' THEN
    RAISE EXCEPTION 'SECURITY FAIL: Expected too_many_attempts lockout on 5th wrong PIN, got %', v_pod_res;
  END IF;

  -- Even supplying the REAL PIN while locked out MUST fail with `too_many_attempts`
  v_pod_res := public.complete_delivery_with_pod(v_cod_id, v_cod_pin, 'https://cdn.orderflow.ng/pod1.jpg');
  IF (v_pod_res ->> 'success')::boolean OR (v_pod_res ->> 'code') <> 'too_many_attempts' THEN
    RAISE EXCEPTION 'SECURITY FAIL: Locked-out delivery accepted real PIN before vendor rotation!';
  END IF;

  -- Switch to Vendor Alpha (`00000000-0000-4000-8000-00000000000a`) to rotate secrets & unlock
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
  v_rot_res := public.rotate_delivery_pod_secrets(v_cod_id);
  IF NOT (v_rot_res ->> 'success')::boolean THEN
    RAISE EXCEPTION 'TEST FAIL: Vendor could not rotate POD secrets: %', v_rot_res;
  END IF;
  v_new_pin := v_rot_res ->> 'pod_verification_code';
  v_new_token := v_rot_res ->> 'recipient_tracking_token';

  -- Old token MUST now behave strictly as Case C (revoked/replaced)
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT * INTO v_track_c FROM public.get_public_tracking(v_cod_code, v_cod_token);
  IF v_track_c.pod_verification_code IS NOT NULL OR v_track_c.amount_due IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY FAIL: Rotated/revoked token still disclosed PIN or COD amount!';
  END IF;

  -- Switch back to Rider 1 to complete POD with rotated PIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

  -- Missing required photo must be rejected WITHOUT incrementing failed attempts
  v_pod_res := public.complete_delivery_with_pod(v_cod_id, v_new_pin, NULL);
  IF (v_pod_res ->> 'success')::boolean OR (v_pod_res ->> 'code') <> 'photo_required' THEN
    RAISE EXCEPTION 'SECURITY FAIL: Missing required POD photo was not rejected: %', v_pod_res;
  END IF;

  -- Valid rotated PIN + valid HTTPS photo completes COD delivery & marks payment_status = 'collected'
  v_pod_res := public.complete_delivery_with_pod(v_cod_id, v_new_pin, 'https://cdn.orderflow.ng/pod-verified.jpg');
  IF NOT (v_pod_res ->> 'success')::boolean THEN
    RAISE EXCEPTION 'TEST FAIL: Valid POD completion failed: %', v_pod_res;
  END IF;

  -- Switch to Vendor Alpha to read `deliveries` row via RLS
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
  SELECT payment_method, payment_status INTO v_pm, v_ps FROM public.deliveries WHERE id = v_cod_id;
  IF v_pm <> 'cash_on_delivery' OR v_ps <> 'collected' THEN
    RAISE EXCEPTION 'TEST FAIL: Expected cash_on_delivery/collected after POD, got %/%', v_pm, v_ps;
  END IF;

  -- Post-delivery Case B check: PIN MUST be NULL once delivered, and POD photo NEVER exposed publicly
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT * INTO v_track_post FROM public.get_public_tracking(v_cod_code, v_new_token);
  IF v_track_post.pod_verification_code IS NOT NULL OR v_track_post.pod_photo_url IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY FAIL: Post-delivery tracking exposed PIN or POD photo!';
  END IF;

  -- Verify `pay_at_pickup` delivery keeps `payment_status = 'pending'` upon POD completion
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
  PERFORM public.accept_delivery_opportunity(v_pap_id, '00000000-0000-4000-8000-000000000002');
  PERFORM public.transition_delivery_status(v_pap_id, 'picked_up');
  PERFORM public.transition_delivery_status(v_pap_id, 'in_transit');
  v_pod_res := public.complete_delivery_with_pod(v_pap_id, v_pap_pin, NULL);
  IF NOT (v_pod_res ->> 'success')::boolean THEN
    RAISE EXCEPTION 'TEST FAIL: Rider 2 could not complete pay_at_pickup POD: %', v_pod_res;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
  SELECT payment_method, payment_status INTO v_pm, v_ps FROM public.deliveries WHERE id = v_pap_id;
  IF v_pm <> 'pay_at_pickup' OR v_ps <> 'pending' THEN
    RAISE EXCEPTION 'SECURITY FAIL: pay_at_pickup unexpectedly changed payment_status to %', v_ps;
  END IF;

  RESET ROLE;
END;
$$;
