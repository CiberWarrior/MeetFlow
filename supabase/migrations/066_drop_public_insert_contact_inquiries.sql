-- 066: Remove the public INSERT policy on contact_inquiries
--
-- "Anyone can insert contact inquiries" allows anon and authenticated INSERT
-- with WITH CHECK (true), so the anon key can write rows directly and skip
-- the API validation and rate limiting.
--
-- Both public contact forms (/api/contact and /api/conferences/[slug]/contact)
-- insert through the server-only service-role client, which bypasses RLS, so
-- this policy is not needed. The super-admin SELECT, UPDATE, and DELETE
-- policies stay unchanged.
--
-- Run manually in the Supabase SQL Editor after approval. Do not use
-- `supabase db push`: migration history is not reconciled (see docs/AI_HANDOFF.md).

BEGIN;

DROP POLICY "Anyone can insert contact inquiries"
ON public.contact_inquiries;

COMMIT;
