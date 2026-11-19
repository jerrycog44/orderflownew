BEGIN;

CREATE TABLE public.rh_discovery_candidates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid REFERENCES public.rh_discovery_runs(id) ON DELETE SET NULL,
    lead_type text NOT NULL CHECK (lead_type IN ('rider','company')),
    full_name text,
    business_name text,
    city text NOT NULL DEFAULT 'Ibadan',
    area text,
    public_phone text,
    public_email text,
    website text,
    source_type text NOT NULL CHECK (
        source_type IN ('official_website','approved_directory','referral','manual','inbound')
    ),
    source_url text NOT NULL,
    source_title text,
    evidence_summary text NOT NULL,
    verification_status text NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending','verified','rejected')),
    review_status text NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending','accepted','rejected','duplicate')),
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (lead_type = 'rider' AND full_name IS NOT NULL)
        OR (lead_type = 'company' AND business_name IS NOT NULL)
    )
);

CREATE INDEX rh_discovery_candidates_review_idx
ON public.rh_discovery_candidates(review_status, created_at DESC);

CREATE INDEX rh_discovery_candidates_run_idx
ON public.rh_discovery_candidates(run_id);

ALTER TABLE public.rh_discovery_candidates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rh_discovery_candidates FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.rh_discovery_candidates TO authenticated;

CREATE POLICY rh_candidates_staff_read
ON public.rh_discovery_candidates FOR SELECT TO authenticated
USING (public.rh_is_staff());

CREATE POLICY rh_candidates_staff_insert
ON public.rh_discovery_candidates FOR INSERT TO authenticated
WITH CHECK (public.rh_is_staff());

CREATE POLICY rh_candidates_staff_update
ON public.rh_discovery_candidates FOR UPDATE TO authenticated
USING (public.rh_is_staff())
WITH CHECK (public.rh_is_staff());

COMMIT;
