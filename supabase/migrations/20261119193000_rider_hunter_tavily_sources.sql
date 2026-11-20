BEGIN;

CREATE TABLE public.rh_discovery_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid REFERENCES public.rh_discovery_runs(id) ON DELETE CASCADE,
    lead_type text NOT NULL CHECK (lead_type IN ('rider','company')),
    source_url text NOT NULL,
    source_title text NOT NULL,
    evidence_summary text NOT NULL,
    search_query text NOT NULL,
    review_status text NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending','reviewed','irrelevant')),
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (run_id, source_url)
);

CREATE INDEX rh_discovery_sources_review_idx
ON public.rh_discovery_sources(review_status, created_at DESC);

ALTER TABLE public.rh_discovery_sources ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rh_discovery_sources FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.rh_discovery_sources TO authenticated;

CREATE POLICY rh_discovery_sources_staff_read
ON public.rh_discovery_sources FOR SELECT TO authenticated
USING (public.rh_is_staff());

CREATE POLICY rh_discovery_sources_staff_insert
ON public.rh_discovery_sources FOR INSERT TO authenticated
WITH CHECK (public.rh_is_staff());

CREATE POLICY rh_discovery_sources_staff_update
ON public.rh_discovery_sources FOR UPDATE TO authenticated
USING (public.rh_is_staff())
WITH CHECK (public.rh_is_staff());

COMMIT;
