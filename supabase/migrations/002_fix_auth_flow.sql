-- ============================================================================
-- ORDERFLOW MIGRATION 002: FIX AUTH FLOW & PROFILE AUTO-CREATION
-- Run this in Supabase SQL Editor AFTER migration 001
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RELAX PROFILE CONSTRAINTS
-- role is selected AFTER signup, phone is confirmed during onboarding.
-- Both will be set by the app at the right time, not forced at row creation.
-- ----------------------------------------------------------------------------

ALTER TABLE profiles ALTER COLUMN role DROP NOT NULL;
ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_phone_format;

-- ----------------------------------------------------------------------------
-- 2. AUTO-PROFILE CREATION TRIGGER
-- Fires immediately when Supabase Auth creates a new user in auth.users.
-- This guarantees the profiles row always exists before any downstream
-- table (vendors, logistics_providers) tries to reference it via FK.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), 'User'),
    COALESCE(NEW.email, ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),  -- NULL is fine now
    NULL,   -- role assigned during role selection step
    FALSE
  )
  ON CONFLICT (id) DO NOTHING; -- safe to re-run, never overwrites existing profile
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- END OF MIGRATION 002
-- ============================================================================
