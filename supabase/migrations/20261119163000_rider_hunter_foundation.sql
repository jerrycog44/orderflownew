BEGIN;

CREATE SCHEMA IF NOT EXISTS rh_private;
REVOKE ALL ON SCHEMA rh_private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION rh_private.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rh_private.set_updated_at()
FROM PUBLIC, anon, authenticated;

-- STAFF
CREATE TABLE public.rh_staff_members (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    staff_role text NOT NULL DEFAULT 'operator'
        CHECK (staff_role IN ('admin', 'operator')),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_staff_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rh_staff_members FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rh_is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, auth AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.rh_staff_members s
        WHERE s.user_id = auth.uid() AND s.is_active
    );
$$;

CREATE OR REPLACE FUNCTION public.rh_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, auth AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.rh_staff_members s
        WHERE s.user_id = auth.uid()
          AND s.is_active AND s.staff_role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.rh_is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rh_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_is_admin() TO authenticated;

-- CAMPAIGNS
CREATE TABLE public.rh_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    city text NOT NULL DEFAULT 'Ibadan',
    target_lead_type text NOT NULL DEFAULT 'both'
        CHECK (target_lead_type IN ('rider', 'company', 'both')),
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','active','paused','completed','archived')),
    start_date date,
    end_date date,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- LEADS
CREATE TABLE public.rh_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_type text NOT NULL CHECK (lead_type IN ('rider','company')),
    full_name text NOT NULL,
    business_name text,
    phone text,
    whatsapp_phone text,
    email text,
    city text NOT NULL DEFAULT 'Ibadan',
    area text,
    website text,
    google_place_id text,
    verification_status text NOT NULL DEFAULT 'unverified'
        CHECK (verification_status IN ('unverified','pending','verified','rejected')),
    recruitment_status text NOT NULL DEFAULT 'new'
        CHECK (recruitment_status IN (
            'new','contacted','interested','registered',
            'not_interested','unreachable','do_not_contact'
        )),
    notes text,
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT rh_leads_phone_e164
        CHECK (phone IS NULL OR phone ~ '^[+][1-9][0-9]{7,14}$'),
    CONSTRAINT rh_leads_whatsapp_e164
        CHECK (whatsapp_phone IS NULL OR whatsapp_phone ~ '^[+][1-9][0-9]{7,14}$')
);

CREATE INDEX rh_leads_type_idx ON public.rh_leads(lead_type);
CREATE INDEX rh_leads_city_idx ON public.rh_leads(city);
CREATE INDEX rh_leads_recruitment_status_idx ON public.rh_leads(recruitment_status);
CREATE INDEX rh_leads_verification_status_idx ON public.rh_leads(verification_status);
CREATE INDEX rh_leads_assigned_to_idx ON public.rh_leads(assigned_to);
CREATE INDEX rh_leads_google_place_id_idx ON public.rh_leads(google_place_id)
WHERE google_place_id IS NOT NULL;

-- LEAD SOURCES
CREATE TABLE public.rh_lead_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid NOT NULL REFERENCES public.rh_leads(id) ON DELETE CASCADE,
    source_type text NOT NULL CHECK (source_type IN (
        'manual','official_website','approved_directory',
        'referral','inbound','consented_signup','google_places'
    )),
    source_name text,
    source_url text,
    external_reference text,
    collected_at timestamptz NOT NULL DEFAULT now(),
    collected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT rh_google_places_identifier_only CHECK (
        source_type <> 'google_places'
        OR (
            external_reference IS NOT NULL
            AND source_name IS NULL
            AND source_url IS NULL
            AND notes IS NULL
        )
    )
);

CREATE INDEX rh_lead_sources_lead_id_idx
ON public.rh_lead_sources(lead_id);

-- DISCOVERY RUNS
CREATE TABLE public.rh_discovery_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid REFERENCES public.rh_campaigns(id) ON DELETE SET NULL,
    agent_name text NOT NULL,
    lead_type text NOT NULL CHECK (lead_type IN ('rider','company','both')),
    search_area text,
    search_summary text,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','running','completed','failed','cancelled')),
    leads_found integer NOT NULL DEFAULT 0 CHECK (leads_found >= 0),
    started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at timestamptz,
    completed_at timestamptz,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rh_discovery_runs_campaign_id_idx
ON public.rh_discovery_runs(campaign_id);
CREATE INDEX rh_discovery_runs_status_idx
ON public.rh_discovery_runs(status);

-- CONTACT PREFERENCES
CREATE TABLE public.rh_contact_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid NOT NULL REFERENCES public.rh_leads(id) ON DELETE CASCADE,
    channel text NOT NULL CHECK (channel IN ('whatsapp','email','sms','phone')),
    consent_status text NOT NULL DEFAULT 'unknown'
        CHECK (consent_status IN ('unknown','opted_in','opted_out')),
    consent_method text,
    consented_at timestamptz,
    withdrawn_at timestamptz,
    proof_reference text,
    notes text,
    recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT rh_contact_preferences_unique UNIQUE (lead_id, channel),
    CONSTRAINT rh_contact_preferences_consent_dates CHECK (
        (consent_status <> 'opted_in' OR consented_at IS NOT NULL)
        AND (consent_status <> 'opted_out' OR withdrawn_at IS NOT NULL)
    )
);

CREATE INDEX rh_contact_preferences_lookup_idx
ON public.rh_contact_preferences(lead_id, channel, consent_status);

-- CONSENT HISTORY
CREATE TABLE public.rh_consent_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    preference_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    channel text NOT NULL,
    previous_status text,
    new_status text NOT NULL,
    consent_method text,
    proof_reference text,
    notes text,
    recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rh_consent_events_lead_idx
ON public.rh_consent_events(lead_id, channel, recorded_at DESC);

CREATE OR REPLACE FUNCTION rh_private.record_consent_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.rh_is_admin() THEN
        RAISE EXCEPTION 'Only an active Rider Hunter admin can change consent.';
    END IF;

    IF TG_OP = 'INSERT'
       OR OLD.consent_status IS DISTINCT FROM NEW.consent_status
       OR OLD.consent_method IS DISTINCT FROM NEW.consent_method
       OR OLD.proof_reference IS DISTINCT FROM NEW.proof_reference
       OR OLD.notes IS DISTINCT FROM NEW.notes THEN
        INSERT INTO public.rh_consent_events (
            preference_id, lead_id, channel, previous_status,
            new_status, consent_method, proof_reference, notes, recorded_by
        ) VALUES (
            NEW.id, NEW.lead_id, NEW.channel,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.consent_status END,
            NEW.consent_status, NEW.consent_method, NEW.proof_reference,
            NEW.notes, COALESCE(auth.uid(), NEW.recorded_by)
        );
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rh_private.record_consent_event()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rh_contact_preferences_history
AFTER INSERT OR UPDATE ON public.rh_contact_preferences
FOR EACH ROW EXECUTE FUNCTION rh_private.record_consent_event();

-- MESSAGE DRAFTS
CREATE TABLE public.rh_message_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid NOT NULL REFERENCES public.rh_leads(id) ON DELETE CASCADE,
    campaign_id uuid REFERENCES public.rh_campaigns(id) ON DELETE SET NULL,
    channel text NOT NULL CHECK (channel IN ('whatsapp','email','sms','phone')),
    message_subject text,
    message_body text NOT NULL,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','pending_approval','rejected','cancelled')),
    drafted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rh_message_drafts_lead_idx ON public.rh_message_drafts(lead_id);
CREATE INDEX rh_message_drafts_status_idx ON public.rh_message_drafts(status);

-- APPROVALS
CREATE TABLE public.rh_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id uuid NOT NULL UNIQUE
        REFERENCES public.rh_message_drafts(id) ON DELETE CASCADE,
    decision text NOT NULL DEFAULT 'pending'
        CHECK (decision IN ('pending','approved','rejected')),
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    reviewer_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT rh_approval_review_fields CHECK (
        (decision = 'pending' AND reviewed_at IS NULL)
        OR (decision <> 'pending' AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX rh_approvals_decision_idx ON public.rh_approvals(decision);

CREATE OR REPLACE FUNCTION rh_private.enforce_approval_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth AS $$
DECLARE
    target_lead_id uuid;
    target_channel text;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.decision <> 'pending' THEN
        RAISE EXCEPTION 'A reviewed approval decision is immutable.';
    END IF;

    IF NEW.decision <> 'pending' THEN
        IF auth.uid() IS NOT NULL AND NOT public.rh_is_admin() THEN
            RAISE EXCEPTION 'Only an active Rider Hunter admin can review messages.';
        END IF;

        NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
        NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());

        IF NEW.reviewed_by IS NULL THEN
            RAISE EXCEPTION 'A reviewer must be recorded.';
        END IF;
    END IF;

    IF NEW.decision = 'approved' THEN
        SELECT d.lead_id, d.channel
        INTO target_lead_id, target_channel
        FROM public.rh_message_drafts d
        WHERE d.id = NEW.draft_id;

        IF target_lead_id IS NULL THEN
            RAISE EXCEPTION 'The message draft does not exist.';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.rh_contact_preferences p
            WHERE p.lead_id = target_lead_id
              AND p.channel = target_channel
              AND p.consent_status = 'opted_in'
              AND p.consented_at IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'Cannot approve without recorded channel consent.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rh_private.enforce_approval_rules()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rh_approvals_guard
BEFORE INSERT OR UPDATE ON public.rh_approvals
FOR EACH ROW EXECUTE FUNCTION rh_private.enforce_approval_rules();

-- PROTECT APPROVED MESSAGE CONTENT
CREATE OR REPLACE FUNCTION rh_private.protect_approved_draft()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.rh_approvals a
        WHERE a.draft_id = OLD.id AND a.decision = 'approved'
    ) THEN
        RAISE EXCEPTION 'An approved message draft cannot be changed or deleted.';
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rh_private.protect_approved_draft()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rh_message_drafts_protect_update
BEFORE UPDATE OR DELETE ON public.rh_message_drafts
FOR EACH ROW EXECUTE FUNCTION rh_private.protect_approved_draft();

-- ACTIVITY LOGS
CREATE TABLE public.rh_activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rh_activity_logs_created_at_idx
ON public.rh_activity_logs(created_at DESC);
CREATE INDEX rh_activity_logs_entity_idx
ON public.rh_activity_logs(entity_type, entity_id);

-- UPDATED_AT TRIGGERS
CREATE TRIGGER rh_staff_members_updated_at BEFORE UPDATE
ON public.rh_staff_members FOR EACH ROW
EXECUTE FUNCTION rh_private.set_updated_at();

CREATE TRIGGER rh_campaigns_updated_at BEFORE UPDATE
ON public.rh_campaigns FOR EACH ROW
EXECUTE FUNCTION rh_private.set_updated_at();

CREATE TRIGGER rh_leads_updated_at BEFORE UPDATE
ON public.rh_leads FOR EACH ROW
EXECUTE FUNCTION rh_private.set_updated_at();

CREATE TRIGGER rh_discovery_runs_updated_at BEFORE UPDATE
ON public.rh_discovery_runs FOR EACH ROW
EXECUTE FUNCTION rh_private.set_updated_at();

CREATE TRIGGER rh_contact_preferences_updated_at BEFORE UPDATE
ON public.rh_contact_preferences FOR EACH ROW
EXECUTE FUNCTION rh_private.set_updated_at();

CREATE TRIGGER rh_message_drafts_updated_at BEFORE UPDATE
ON public.rh_message_drafts FOR EACH ROW
EXECUTE FUNCTION rh_private.set_updated_at();

CREATE TRIGGER rh_approvals_updated_at BEFORE UPDATE
ON public.rh_approvals FOR EACH ROW
EXECUTE FUNCTION rh_private.set_updated_at();

-- RLS
ALTER TABLE public.rh_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_discovery_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_contact_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_message_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_activity_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
    public.rh_campaigns, public.rh_leads, public.rh_lead_sources,
    public.rh_discovery_runs, public.rh_contact_preferences,
    public.rh_consent_events, public.rh_message_drafts,
    public.rh_approvals, public.rh_activity_logs
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON
    public.rh_campaigns, public.rh_leads, public.rh_lead_sources,
    public.rh_discovery_runs, public.rh_message_drafts
TO authenticated;

GRANT DELETE ON
    public.rh_campaigns, public.rh_leads, public.rh_lead_sources
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON public.rh_contact_preferences TO authenticated;

GRANT SELECT ON public.rh_consent_events TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON public.rh_approvals TO authenticated;

GRANT SELECT, INSERT
ON public.rh_activity_logs TO authenticated;

-- CAMPAIGNS
CREATE POLICY rh_campaigns_staff_read ON public.rh_campaigns
FOR SELECT TO authenticated USING (public.rh_is_staff());
CREATE POLICY rh_campaigns_staff_insert ON public.rh_campaigns
FOR INSERT TO authenticated WITH CHECK (public.rh_is_staff());
CREATE POLICY rh_campaigns_staff_update ON public.rh_campaigns
FOR UPDATE TO authenticated USING (public.rh_is_staff())
WITH CHECK (public.rh_is_staff());
CREATE POLICY rh_campaigns_admin_delete ON public.rh_campaigns
FOR DELETE TO authenticated USING (public.rh_is_admin());

-- LEADS
CREATE POLICY rh_leads_staff_read ON public.rh_leads
FOR SELECT TO authenticated USING (public.rh_is_staff());
CREATE POLICY rh_leads_staff_insert ON public.rh_leads
FOR INSERT TO authenticated WITH CHECK (public.rh_is_staff());
CREATE POLICY rh_leads_staff_update ON public.rh_leads
FOR UPDATE TO authenticated USING (public.rh_is_staff())
WITH CHECK (public.rh_is_staff());
CREATE POLICY rh_leads_admin_delete ON public.rh_leads
FOR DELETE TO authenticated USING (public.rh_is_admin());

-- LEAD SOURCES
CREATE POLICY rh_lead_sources_staff_read ON public.rh_lead_sources
FOR SELECT TO authenticated USING (public.rh_is_staff());
CREATE POLICY rh_lead_sources_staff_insert ON public.rh_lead_sources
FOR INSERT TO authenticated WITH CHECK (public.rh_is_staff());
CREATE POLICY rh_lead_sources_staff_update ON public.rh_lead_sources
FOR UPDATE TO authenticated USING (public.rh_is_staff())
WITH CHECK (public.rh_is_staff());
CREATE POLICY rh_lead_sources_admin_delete ON public.rh_lead_sources
FOR DELETE TO authenticated USING (public.rh_is_admin());

-- DISCOVERY RUNS
CREATE POLICY rh_discovery_runs_staff_read ON public.rh_discovery_runs
FOR SELECT TO authenticated USING (public.rh_is_staff());
CREATE POLICY rh_discovery_runs_staff_insert ON public.rh_discovery_runs
FOR INSERT TO authenticated WITH CHECK (public.rh_is_staff());
CREATE POLICY rh_discovery_runs_staff_update ON public.rh_discovery_runs
FOR UPDATE TO authenticated USING (public.rh_is_staff())
WITH CHECK (public.rh_is_staff());

-- CONTACT PREFERENCES
CREATE POLICY rh_contact_preferences_staff_read
ON public.rh_contact_preferences FOR SELECT TO authenticated
USING (public.rh_is_staff());

CREATE POLICY rh_contact_preferences_admin_insert
ON public.rh_contact_preferences FOR INSERT TO authenticated
WITH CHECK (public.rh_is_admin());

CREATE POLICY rh_contact_preferences_admin_update
ON public.rh_contact_preferences FOR UPDATE TO authenticated
USING (public.rh_is_admin()) WITH CHECK (public.rh_is_admin());

-- CONSENT HISTORY: read-only for staff.
CREATE POLICY rh_consent_events_staff_read
ON public.rh_consent_events FOR SELECT TO authenticated
USING (public.rh_is_staff());

-- MESSAGE DRAFTS
CREATE POLICY rh_message_drafts_staff_read
ON public.rh_message_drafts FOR SELECT TO authenticated
USING (public.rh_is_staff());

CREATE POLICY rh_message_drafts_staff_insert
ON public.rh_message_drafts FOR INSERT TO authenticated
WITH CHECK (public.rh_is_staff());

CREATE POLICY rh_message_drafts_staff_update
ON public.rh_message_drafts FOR UPDATE TO authenticated
USING (public.rh_is_staff()) WITH CHECK (public.rh_is_staff());

-- APPROVALS
CREATE POLICY rh_approvals_staff_read
ON public.rh_approvals FOR SELECT TO authenticated
USING (public.rh_is_staff());

CREATE POLICY rh_approvals_staff_pending_insert
ON public.rh_approvals FOR INSERT TO authenticated
WITH CHECK (
    public.rh_is_staff()
    AND (decision = 'pending' OR public.rh_is_admin())
);

CREATE POLICY rh_approvals_admin_update
ON public.rh_approvals FOR UPDATE TO authenticated
USING (public.rh_is_admin()) WITH CHECK (public.rh_is_admin());

-- ACTIVITY LOGS
CREATE POLICY rh_activity_logs_staff_read
ON public.rh_activity_logs FOR SELECT TO authenticated
USING (public.rh_is_staff());

CREATE POLICY rh_activity_logs_staff_insert
ON public.rh_activity_logs FOR INSERT TO authenticated
WITH CHECK (
    public.rh_is_staff() AND actor_user_id = auth.uid()
);

COMMIT;
