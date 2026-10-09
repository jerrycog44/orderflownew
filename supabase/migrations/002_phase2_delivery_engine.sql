-- OrderFlow Phase 2: atomic delivery and package creation.
-- Review this migration before applying it to any Supabase project.

CREATE OR REPLACE FUNCTION public.create_delivery_with_package(
  p_dispatch_mode text,
  p_pickup_address text,
  p_pickup_city text,
  p_pickup_contact_name text,
  p_pickup_contact_phone text,
  p_destination_address text,
  p_destination_city text,
  p_recipient_name text,
  p_recipient_phone text,
  p_delivery_notes text,
  p_estimated_price numeric,
  p_estimated_delivery_time text,
  p_product_name text,
  p_item_category text,
  p_package_type text,
  p_quantity integer,
  p_weight_kg numeric,
  p_length_cm numeric,
  p_width_cm numeric,
  p_height_cm numeric,
  p_is_fragile boolean,
  p_image_url text,
  p_special_instructions text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_delivery_id uuid;
  v_tracking_code text;
  v_attempt integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vendors WHERE id = v_user_id
  ) THEN
    RAISE EXCEPTION 'A registered vendor account is required';
  END IF;

  IF p_dispatch_mode NOT IN ('auto', 'manual') THEN
    RAISE EXCEPTION 'Invalid dispatch mode';
  END IF;

  IF p_package_type NOT IN ('parcel', 'box', 'bag', 'fragile_item', 'other') THEN
    RAISE EXCEPTION 'Invalid package type';
  END IF;

  IF COALESCE(p_estimated_price, -1) < 0
     OR COALESCE(p_quantity, 0) < 1
     OR COALESCE(p_weight_kg, 0) <= 0 THEN
    RAISE EXCEPTION 'Invalid price or package details';
  END IF;

  -- Use a long random tracking suffix and retry on the extremely unlikely collision.
  LOOP
    v_tracking_code :=
      'OF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.deliveries WHERE tracking_code = v_tracking_code
    );
    v_attempt := v_attempt + 1;
    IF v_attempt >= 5 THEN
      RAISE EXCEPTION 'Could not generate a unique tracking code';
    END IF;
  END LOOP;

  INSERT INTO public.deliveries (
    tracking_code, vendor_id, status, dispatch_mode,
    pickup_address, pickup_city, pickup_contact_name, pickup_contact_phone,
    destination_address, destination_city, recipient_name, recipient_phone,
    delivery_notes, estimated_price, estimated_delivery_time
  )
  VALUES (
    v_tracking_code, v_user_id, 'searching',
    p_dispatch_mode::public.dispatch_mode_enum,
    p_pickup_address, p_pickup_city,
    NULLIF(p_pickup_contact_name, ''), NULLIF(p_pickup_contact_phone, ''),
    p_destination_address, p_destination_city, p_recipient_name, p_recipient_phone,
    NULLIF(p_delivery_notes, ''), p_estimated_price, p_estimated_delivery_time
  )
  RETURNING id INTO v_delivery_id;

  INSERT INTO public.package_details (
    delivery_id, product_name, item_category, package_type, quantity,
    weight_kg, length_cm, width_cm, height_cm, is_fragile,
    image_url, special_instructions
  )
  VALUES (
    v_delivery_id, p_product_name, p_item_category,
    p_package_type::public.package_type_enum, p_quantity, p_weight_kg,
    p_length_cm, p_width_cm, p_height_cm, COALESCE(p_is_fragile, false),
    NULLIF(p_image_url, ''), NULLIF(p_special_instructions, '')
  );

  INSERT INTO public.delivery_status_history (
    delivery_id, previous_status, new_status, changed_by_user_id, notes
  )
  VALUES (
    v_delivery_id, NULL, 'searching', v_user_id, 'Delivery created'
  );

  RETURN jsonb_build_object(
    'id', v_delivery_id,
    'tracking_code', v_tracking_code,
    'status', 'searching'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_delivery_with_package(
  text, text, text, text, text, text, text, text, text, text,
  numeric, text, text, text, text, integer, numeric, numeric,
  numeric, numeric, boolean, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_delivery_with_package(
  text, text, text, text, text, text, text, text, text, text,
  numeric, text, text, text, text, integer, numeric, numeric,
  numeric, numeric, boolean, text, text
) TO authenticated;

DROP POLICY IF EXISTS
  "Users can record status history for their deliveries"
  ON public.delivery_status_history;

CREATE POLICY "Users can record status history for their deliveries"
ON public.delivery_status_history
FOR INSERT TO authenticated
WITH CHECK (
  changed_by_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.id = delivery_status_history.delivery_id
      AND d.vendor_id = auth.uid()
  )
);
