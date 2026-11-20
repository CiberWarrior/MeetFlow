-- Restores the registration and abstract policies from migration 056,
-- before 068 required can_view_registrations and can_manage_abstracts.
-- Run manually in the Supabase SQL Editor only if 068 must be undone.

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
    )
  );
