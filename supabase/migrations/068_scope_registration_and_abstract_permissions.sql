-- Scope registration rows to can_view_registrations and abstract rows to can_manage_abstracts.
-- Super admins are unchanged. The service role bypasses RLS, so public registration
-- and abstract submission through the API stay as they are.
-- Run this manually in the Supabase SQL Editor. Do not use supabase db push.

DROP POLICY IF EXISTS "Users see registrations for their conferences" ON registrations;
CREATE POLICY "Users see registrations for their conferences"
  ON registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin' AND active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM conference_permissions
      WHERE user_id = auth.uid()
        AND conference_id = registrations.conference_id
        AND can_view_registrations = true
    )
  );

DROP POLICY IF EXISTS "Users can manage registrations for their conferences" ON registrations;
CREATE POLICY "Users can manage registrations for their conferences"
  ON registrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin' AND active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM conference_permissions
      WHERE user_id = auth.uid()
        AND conference_id = registrations.conference_id
        AND can_view_registrations = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin' AND active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM conference_permissions
      WHERE user_id = auth.uid()
        AND conference_id = registrations.conference_id
        AND can_view_registrations = true
    )
  );

DROP POLICY IF EXISTS "Users see abstracts for their conferences" ON abstracts;
CREATE POLICY "Users see abstracts for their conferences"
  ON abstracts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin' AND active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM conference_permissions
      WHERE user_id = auth.uid()
        AND conference_id = abstracts.conference_id
        AND can_manage_abstracts = true
    )
  );

DROP POLICY IF EXISTS "Users can manage abstracts for their conferences" ON abstracts;
CREATE POLICY "Users can manage abstracts for their conferences"
  ON abstracts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin' AND active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM conference_permissions
      WHERE user_id = auth.uid()
        AND conference_id = abstracts.conference_id
        AND can_manage_abstracts = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin' AND active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM conference_permissions
      WHERE user_id = auth.uid()
        AND conference_id = abstracts.conference_id
        AND can_manage_abstracts = true
    )
  );
