-- ============================================================================
-- ORDERFLOW DATABASE MIGRATION 003: CONCURRENCY-SAFE DISPATCH & SECURITY HARDENING
-- Run this in Supabase SQL Editor AFTER migrations 001 and 002
-- Architecture Blueprint: docs/phase-6.1-database-architecture.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HARDEN SECURITY DEFINER HELPER PRIVILEGES
-- Internal RLS helpers should NOT be callable by unauthenticated anonymous clients.
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION has_active_dispatch_opportunity(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION has_active_dispatch_opportunity(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION has_active_dispatch_opportunity(UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION is_delivery_owner(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_delivery_owner(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION is_delivery_owner(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. ATOMIC DISPATCH ACCEPTANCE RPC
-- Prevents double-assignment across multiple providers using row-level locking (FOR UPDATE).
-- Atomically updates delivery, marks opportunity accepted, and creates audit trail.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION accept_delivery_opportunity(
  p_delivery_id UUID,
  p_provider_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery RECORD;
  v_assigned_opp RECORD;
BEGIN
  -- 1. Lock the delivery row to prevent concurrent assignment
  SELECT * INTO v_delivery
  FROM deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery not found');
  END IF;

  -- 2. Guard against double-assignment or terminal status
  IF v_delivery.status NOT IN ('created', 'searching', 'opportunity_sent', 'awaiting_pickup') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery is no longer available (current status: ' || v_delivery.status || ')'
    );
  END IF;

  -- 3. Verify provider opportunity
  SELECT * INTO v_assigned_opp
  FROM dispatch_opportunities
  WHERE delivery_id = p_delivery_id AND provider_id = p_provider_id
  FOR UPDATE;

  -- 4. Update delivery with assigned provider and transition status
  -- (Trigger trg_validate_delivery_status_transition automatically creates audit log)
  UPDATE deliveries
  SET provider_id = p_provider_id,
      status = 'provider_selected',
      updated_at = NOW()
  WHERE id = p_delivery_id;

  -- 5. Mark accepted opportunity
  IF v_assigned_opp.id IS NOT NULL THEN
    UPDATE dispatch_opportunities
    SET status = 'accepted', responded_at = NOW()
    WHERE id = v_assigned_opp.id;
  END IF;

  -- 6. Expire other queued or sent opportunities for this delivery
  UPDATE dispatch_opportunities
  SET status = 'expired'
  WHERE delivery_id = p_delivery_id
    AND provider_id != p_provider_id
    AND status IN ('queued', 'sent');

  RETURN jsonb_build_object(
    'success', true,
    'delivery_id', p_delivery_id,
    'status', 'provider_selected'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_delivery_opportunity(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. ATOMIC OPPORTUNITY DECLINE & QUEUE ADVANCEMENT RPC
-- Declines the targeted opportunity and automatically advances to the next candidate in line.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION decline_delivery_opportunity(
  p_delivery_id UUID,
  p_provider_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_opp RECORD;
  v_current_status delivery_status;
BEGIN
  -- 1. Mark current opportunity as declined
  UPDATE dispatch_opportunities
  SET status = 'declined', responded_at = NOW()
  WHERE delivery_id = p_delivery_id AND provider_id = p_provider_id;

  -- 2. Find next queued candidate by rank order
  SELECT * INTO v_next_opp
  FROM dispatch_opportunities
  WHERE delivery_id = p_delivery_id AND status = 'queued'
  ORDER BY rank_order ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Advance to next candidate
    UPDATE dispatch_opportunities
    SET status = 'sent', sent_at = NOW()
    WHERE id = v_next_opp.id;

    UPDATE deliveries
    SET status = 'opportunity_sent', updated_at = NOW()
    WHERE id = p_delivery_id;

    v_current_status := 'opportunity_sent';
  ELSE
    -- Queue exhausted: return delivery to open searching pool
    UPDATE deliveries
    SET status = 'searching', updated_at = NOW()
    WHERE id = p_delivery_id;

    v_current_status := 'searching';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'delivery_id', p_delivery_id,
    'status', v_current_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION decline_delivery_opportunity(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. DELIVERY STATUS TRANSITION STATE MACHINE TRIGGER
-- Enforces unidirectional lifecycle progression. Prevents invalid state jumps
-- (e.g. moving a delivered package back to created).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION validate_delivery_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If status is not changing, allow update
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Terminal states cannot be changed
  IF OLD.status = 'delivered' THEN
    RAISE EXCEPTION 'Cannot modify status of a delivery that is already delivered';
  END IF;

  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot modify status of a delivery that is cancelled';
  END IF;

  -- Valid transition paths
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
      -- Any unknown previous state
      RAISE EXCEPTION 'Unknown previous delivery status %', OLD.status;
  END CASE;

  -- Automatically append transition to delivery_status_history
  INSERT INTO delivery_status_history (
    delivery_id,
    previous_status,
    new_status,
    changed_by_user_id,
    notes
  ) VALUES (
    NEW.id,
    OLD.status,
    NEW.status,
    auth.uid(),
    'Status transitioned from ' || OLD.status || ' to ' || NEW.status
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_delivery_status_transition ON deliveries;
CREATE TRIGGER trg_validate_delivery_status_transition
  BEFORE UPDATE OF status ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION validate_delivery_status_transition();

-- ----------------------------------------------------------------------------
-- 5. LOGISTICS MARKETPLACE DISCOVERY POLICIES
-- Allows verified logistics carriers to view open unassigned deliveries in their service area
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Providers can view open marketplace deliveries" ON deliveries;
CREATE POLICY "Providers can view open marketplace deliveries"
  ON deliveries FOR SELECT
  TO authenticated
  USING (
    (status IN ('created', 'searching', 'opportunity_sent', 'awaiting_pickup')
     AND (provider_id IS NULL OR provider_id = auth.uid()))
    AND EXISTS (SELECT 1 FROM logistics_providers lp WHERE lp.id = auth.uid())
  );

DROP POLICY IF EXISTS "Providers can view open marketplace package details" ON package_details;
CREATE POLICY "Providers can view open marketplace package details"
  ON package_details FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      JOIN logistics_providers lp ON lp.id = auth.uid()
      WHERE d.id = package_details.delivery_id
        AND (d.status IN ('created', 'searching', 'opportunity_sent', 'awaiting_pickup'))
        AND (d.provider_id IS NULL OR d.provider_id = auth.uid())
    )
  );

-- ============================================================================
-- END OF MIGRATION 003
-- ============================================================================
