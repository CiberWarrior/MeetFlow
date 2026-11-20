-- Scope authenticated SELECT on conferences to assignment / super_admin.
-- Public (anon) read of published conferences stays unchanged.
--
-- Removes:
-- 1) "Allow authenticated read conferences" (USING true) from migration 010
-- 2) OR published = true on "conference_admins_view_conferences" from 025
--
-- Do not apply until explicitly approved. Public pages use admin client or anon.

DROP POLICY IF EXISTS "Allow authenticated read conferences" ON conferences;

DROP POLICY IF EXISTS "conference_admins_view_conferences" ON conferences;

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
);

-- Anon published read (010) must remain:
-- "Allow anon read published conferences" ON conferences FOR SELECT TO anon USING (published = true);
