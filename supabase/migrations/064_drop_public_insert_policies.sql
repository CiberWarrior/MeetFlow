-- 064: Remove insecure public INSERT policies on registrations and abstracts
--
-- Both policies allow anon and authenticated INSERT with WITH CHECK (true).
-- Public registration and abstract submission already write through server
-- routes that use the service role, so these policies are no longer required.

BEGIN;

DROP POLICY "Allow public insert"
ON public.registrations;

DROP POLICY "Allow public insert abstracts"
ON public.abstracts;

COMMIT;
