-- ============================================================================
-- OrderFlow Pre-Migration 005 Historical & Duplicate-Phone Fixture
-- ============================================================================
-- Applied AFTER migrations 001..004 and BEFORE migration 005 to verify:
--   1. Legacy completed deliveries retain NULL payment_method & payment_status
--      and do NOT receive unnecessary POD secret backfills.
--   2. Pre-005 active deliveries retain NULL payment_method & payment_status
--      while receiving non-destructive CSPRNG POD secret backfills.
--   3. Formatted Nigerian phone numbers that collide upon E.164 normalization
--      are safely deduplicated before `chk_profiles_phone_format` is added.
-- ============================================================================

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('00000000-0000-4000-8000-00000000000a', 'vendor-a@orderflow.test', '{"full_name":"Vendor Alpha"}'),
  ('00000000-0000-4000-8000-00000000000b', 'vendor-b@orderflow.test', '{"full_name":"Vendor Beta"}'),
  ('00000000-0000-4000-8000-000000000001', 'rider-1@orderflow.test',  '{"full_name":"Rider One"}'),
  ('00000000-0000-4000-8000-000000000002', 'rider-2@orderflow.test',  '{"full_name":"Rider Two"}'),
  ('00000000-0000-4000-8000-0000000000ff', 'outsider@orderflow.test', '{"full_name":"Outsider"}'),
  ('00000000-0000-4000-8000-0000000000d1', 'dup-phone-1@orderflow.test', '{"full_name":"Dup Phone Older"}'),
  ('00000000-0000-4000-8000-0000000000d2', 'dup-phone-2@orderflow.test', '{"full_name":"Dup Phone Newer"}')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET role = 'vendor', phone = '080 1111 2222', onboarding_completed = true
WHERE id = '00000000-0000-4000-8000-00000000000a';

UPDATE public.profiles SET role = 'vendor', phone = '+2348022223333', onboarding_completed = true
WHERE id = '00000000-0000-4000-8000-00000000000b';

UPDATE public.profiles SET role = 'logistics_provider', phone = '0803-333-4444', onboarding_completed = true
WHERE id = '00000000-0000-4000-8000-000000000001';

UPDATE public.profiles SET role = 'logistics_provider', phone = '+2348044445555', onboarding_completed = true
WHERE id = '00000000-0000-4000-8000-000000000002';

UPDATE public.profiles SET role = 'vendor', phone = '+2348055556666', onboarding_completed = true
WHERE id = '00000000-0000-4000-8000-0000000000ff';

-- Duplicate normalized phone collision fixture: both normalize to '+2348099998888'
UPDATE public.profiles
SET phone = '+2348099998888', created_at = NOW() - INTERVAL '10 days'
WHERE id = '00000000-0000-4000-8000-0000000000d1';

UPDATE public.profiles
SET phone = '080 9999 8888', created_at = NOW() - INTERVAL '1 day'
WHERE id = '00000000-0000-4000-8000-0000000000d2';

INSERT INTO public.vendors (id, business_name, business_category, operating_city)
VALUES
  ('00000000-0000-4000-8000-00000000000a', 'Alpha Mart Ibadan', 'Retail', 'Ibadan'),
  ('00000000-0000-4000-8000-00000000000b', 'Beta Pharmacy', 'Health', 'Ibadan')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.logistics_providers (id, provider_name, provider_type, coverage_area, vehicle_types, package_categories)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'SwiftHaul Rider 1', 'individual_rider', 'Ibadan', ARRAY['Motorcycle'], ARRAY['parcel','box']),
  ('00000000-0000-4000-8000-000000000002', 'ExpressFleet Rider 2', 'courier_company', 'Ibadan', ARRAY['Motorcycle','Van'], ARRAY['parcel','box'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.provider_availability (provider_id, status)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'available'),
  ('00000000-0000-4000-8000-000000000002', 'available')
ON CONFLICT (provider_id) DO NOTHING;

-- Pre-005 historical completed delivery (no payment columns yet)
INSERT INTO public.deliveries (
  id, tracking_code, vendor_id, provider_id,
  pickup_address, pickup_city, destination_address, destination_city,
  recipient_name, recipient_phone, status, dispatch_mode, estimated_price
) VALUES (
  '00000000-0000-4000-8000-000000000901', 'OF-HIST01',
  '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000001',
  '10 Dugbe Rd', 'Ibadan', '22 Bodija Market', 'Ibadan',
  'Chief Adeyemi', '+2348077771111', 'delivered', 'auto', 2500
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.package_details (delivery_id, product_name, item_category, package_type, weight_kg)
VALUES ('00000000-0000-4000-8000-000000000901', 'Historical Fabric Roll', 'Textiles', 'parcel', 1.5)
ON CONFLICT (delivery_id) DO NOTHING;

-- Pre-005 active in-transit delivery (must receive POD secret backfill in 005, while keeping NULL payment fields)
INSERT INTO public.deliveries (
  id, tracking_code, vendor_id, provider_id,
  pickup_address, pickup_city, destination_address, destination_city,
  recipient_name, recipient_phone, status, dispatch_mode, estimated_price
) VALUES (
  '00000000-0000-4000-8000-000000000902', 'OF-ACTV02',
  '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000001',
  '10 Dugbe Rd', 'Ibadan', '44 Ring Road', 'Ibadan',
  'Mrs. Folake', '+2348077772222', 'in_transit', 'auto', 3100
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.package_details (delivery_id, product_name, item_category, package_type, weight_kg)
VALUES ('00000000-0000-4000-8000-000000000902', 'Active Groceries Box', 'Food', 'box', 3.0)
ON CONFLICT (delivery_id) DO NOTHING;
