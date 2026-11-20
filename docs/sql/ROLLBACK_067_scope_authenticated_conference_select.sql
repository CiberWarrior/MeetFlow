-- Rollback for 067_scope_authenticated_conference_select.sql
-- Restores pre-067 authenticated SELECT policies on public.conferences.
-- Anon published policy is unchanged either way.
--
-- Run in Supabase SQL Editor only if you need to undo 067.

DROP POLICY IF EXISTS "conference_admins_view_conferences" ON conferences;

-- From migration 025 (includes OR published = true)
CREATE POLICY "conference_admins_view_conferences" ON conferences
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN conference_permissions cp ON up.id = cp.user_id
    WHERE up.id = auth.uid()
    AND cp.conference_id = conferences.id
    AND up.active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'super_admin'
    AND up.active = true
  )
  OR
  published = true
);

-- From migration 010 (USING true for all authenticated)
DROP POLICY IF EXISTS "Allow authenticated read conferences" ON conferences;

CREATE POLICY "Allow authenticated read conferences" ON conferences
  FOR SELECT
  TO authenticated
  USING (true);

-- Keep intact (not dropped by 067):
-- "Allow anon read published conferences" ON conferences FOR SELECT TO anon USING (published = true);
-- "Users see their conferences" from 013 (if still present)
-- "Super admins can manage conferences" from 013
