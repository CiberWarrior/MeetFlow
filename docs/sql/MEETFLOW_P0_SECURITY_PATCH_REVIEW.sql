-- MeetFlow P0 RLS hardening candidate.
-- REVIEW ONLY: do not apply before a verified backup and staging validation.
-- Based on production schema inspected on 2026-11-06 (project eceiqrhvtxieoqjyvntf).
-- This file is intentionally under docs/sql until reconciled migration history is established.
BEGIN;

-- 1. Authorization assignments: no anonymous access, no self-grant.
ALTER TABLE public.conference_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mf_permissions_self_read ON public.conference_permissions;
CREATE POLICY mf_permissions_self_read ON public.conference_permissions
FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active
  )
);
DROP POLICY IF EXISTS mf_permissions_superadmin_manage ON public.conference_permissions;
CREATE POLICY mf_permissions_superadmin_manage ON public.conference_permissions
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active)
);

-- 2. Custom conference pages: public sees published pages of published/active conferences only.
ALTER TABLE public.conference_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mf_pages_public_read ON public.conference_pages;
CREATE POLICY mf_pages_public_read ON public.conference_pages
FOR SELECT TO anon, authenticated USING (
  published AND EXISTS (
    SELECT 1 FROM public.conferences c
    WHERE c.id = conference_id AND c.published AND c.active
  )
);
DROP POLICY IF EXISTS mf_pages_admin_read ON public.conference_pages;
CREATE POLICY mf_pages_admin_read ON public.conference_pages
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active)
  OR EXISTS (
    SELECT 1 FROM public.conference_permissions cp
    JOIN public.user_profiles up ON up.id = cp.user_id
    WHERE cp.user_id = (SELECT auth.uid()) AND cp.conference_id = conference_id
      AND up.active AND cp.can_edit_conference
  )
);
DROP POLICY IF EXISTS mf_pages_admin_write ON public.conference_pages;
CREATE POLICY mf_pages_admin_write ON public.conference_pages
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active)
  OR EXISTS (SELECT 1 FROM public.conference_permissions cp
             WHERE cp.user_id = (SELECT auth.uid()) AND cp.conference_id = conference_id
               AND cp.can_edit_conference)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active)
  OR EXISTS (SELECT 1 FROM public.conference_permissions cp
             WHERE cp.user_id = (SELECT auth.uid()) AND cp.conference_id = conference_id
               AND cp.can_edit_conference)
);

-- 3. Financial tables: only the conference's payment managers may read/write.
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mf_payment_history_admin ON public.payment_history;
CREATE POLICY mf_payment_history_admin ON public.payment_history
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.registrations r
    WHERE r.id = payment_history.registration_id
      AND (
        EXISTS (SELECT 1 FROM public.user_profiles up
                WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active)
        OR EXISTS (SELECT 1 FROM public.conference_permissions cp
                   JOIN public.user_profiles up ON up.id = cp.user_id
                   WHERE cp.user_id = (SELECT auth.uid())
                     AND cp.conference_id = r.conference_id AND cp.can_manage_payments AND up.active)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.registrations r
    WHERE r.id = payment_history.registration_id
      AND (
        EXISTS (SELECT 1 FROM public.user_profiles up
                WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active)
        OR EXISTS (SELECT 1 FROM public.conference_permissions cp
                   JOIN public.user_profiles up ON up.id = cp.user_id
                   WHERE cp.user_id = (SELECT auth.uid())
                     AND cp.conference_id = r.conference_id AND cp.can_manage_payments AND up.active)
      )
  )
);

ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mf_payment_reminders_admin ON public.payment_reminders;
CREATE POLICY mf_payment_reminders_admin ON public.payment_reminders
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active)
  OR EXISTS (SELECT 1 FROM public.conference_permissions cp
             JOIN public.user_profiles up ON up.id = cp.user_id
             WHERE cp.user_id = (SELECT auth.uid()) AND cp.conference_id = payment_reminders.conference_id
               AND cp.can_manage_payments AND up.active)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active)
  OR EXISTS (SELECT 1 FROM public.conference_permissions cp
             JOIN public.user_profiles up ON up.id = cp.user_id
             WHERE cp.user_id = (SELECT auth.uid()) AND cp.conference_id = payment_reminders.conference_id
               AND cp.can_manage_payments AND up.active)
);

-- 4. Reference catalogue is publicly readable, but writable by superadmin only.
ALTER TABLE public.supported_currencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mf_currencies_public_read ON public.supported_currencies;
CREATE POLICY mf_currencies_public_read ON public.supported_currencies
FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS mf_currencies_superadmin_write ON public.supported_currencies;
CREATE POLICY mf_currencies_superadmin_write ON public.supported_currencies
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles up
              WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up
                   WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active));

-- 5. Tenant-specific access for participants, preserving authorized cross-event history.
-- SECURITY DEFINER helper prevents recursive RLS between participant tables.
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.mf_can_read_participant(p_participant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.conference_permissions cp ON cp.user_id = up.id
    JOIN public.participant_registrations pr ON pr.conference_id = cp.conference_id
    WHERE up.id = (SELECT auth.uid()) AND up.role = 'conference_admin'
      AND up.active AND pr.participant_id = p_participant_id
  );
$$;
REVOKE ALL ON FUNCTION private.mf_can_read_participant(uuid) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.mf_can_read_participant(uuid) TO authenticated;
DROP POLICY IF EXISTS admins_select_participant_profiles ON public.participant_profiles;
CREATE POLICY admins_select_participant_profiles ON public.participant_profiles
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active)
  OR private.mf_can_read_participant(id)
);
DROP POLICY IF EXISTS admins_select_participant_registrations ON public.participant_registrations;
CREATE POLICY admins_select_participant_registrations ON public.participant_registrations
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid()) AND up.role = 'super_admin' AND up.active)
  OR EXISTS (
    SELECT 1 FROM public.conference_permissions cp
    JOIN public.user_profiles up ON up.id = cp.user_id
    WHERE cp.user_id = (SELECT auth.uid())
      AND cp.conference_id = participant_registrations.conference_id AND up.active
  )
);

-- 6. Remove unrestricted reading of ALL conferences by logged-in users.
DROP POLICY IF EXISTS "Allow authenticated read conferences" ON public.conferences;

-- 7. Remove anonymous access to privileged RPCs and definer views.
REVOKE ALL ON public.active_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.contact_inquiry_stats FROM PUBLIC, anon;
-- Retain authenticated stats read for existing Super Admin dashboard until
-- its API usage is migrated; prefer moving this to a server-side admin route.
REVOKE ALL ON FUNCTION public.get_subscription_limits(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_admin_action(varchar,varchar,uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_user_activity(varchar,varchar,uuid,jsonb) FROM PUBLIC, anon;

-- 8. Prevent direct anonymous edits to any sensitive tables, irrespective of policies.
REVOKE ALL ON public.conference_permissions, public.payment_history, public.payment_reminders FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.conference_pages, public.supported_currencies FROM anon;

COMMIT;
