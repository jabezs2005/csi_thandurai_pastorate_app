/*
  # Fix All RLS Recursion - Members, Subscriptions, Activity Logs

  1. Problem
    - All RLS policies on members, subscriptions, and activity_logs
      reference the `profiles` table to check role and church_id.
    - This causes infinite recursion because profiles RLS policies
      may also reference these tables or each other.

  2. Solution
    - Replace all profile-based checks with auth.jwt() app_metadata checks.
    - Super admin checks: auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin'
    - Church admin checks: auth.jwt() -> 'app_metadata' ->> 'church_id' = table.church_id
    - The create_account edge function stores role and church_id in app_metadata
      when creating accounts, so the JWT will contain these values.
    - Also update the "Authenticated users can view churches" policy to allow
      anon access for the login page church selector.
*/

-- ==================== MEMBERS ====================

DROP POLICY IF EXISTS "Super admins can view all members" ON members;
DROP POLICY IF EXISTS "Church admins can view their church members" ON members;
DROP POLICY IF EXISTS "Super admins can insert members" ON members;
DROP POLICY IF EXISTS "Church admins can insert members for their church" ON members;
DROP POLICY IF EXISTS "Super admins can update members" ON members;
DROP POLICY IF EXISTS "Church admins can update their church members" ON members;
DROP POLICY IF EXISTS "Super admins can delete members" ON members;
DROP POLICY IF EXISTS "Church admins can delete their church members" ON members;

CREATE POLICY "Super admins can view all members"
  ON members FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Church admins can view their church members"
  ON members FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'church_id' = members.church_id::text);

CREATE POLICY "Super admins can insert members"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Church admins can insert members for their church"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'church_id' = members.church_id::text);

CREATE POLICY "Super admins can update members"
  ON members FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Church admins can update their church members"
  ON members FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'church_id' = members.church_id::text)
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'church_id' = members.church_id::text);

CREATE POLICY "Super admins can delete members"
  ON members FOR DELETE
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Church admins can delete their church members"
  ON members FOR DELETE
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'church_id' = members.church_id::text);

-- ==================== SUBSCRIPTIONS ====================

DROP POLICY IF EXISTS "Super admins can view all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Church admins can view their church subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Super admins can insert subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Church admins can insert subscriptions for their church" ON subscriptions;
DROP POLICY IF EXISTS "Super admins can update subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Church admins can update their church subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Super admins can delete subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Church admins can delete their church subscriptions" ON subscriptions;

CREATE POLICY "Super admins can view all subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Church admins can view their church subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'church_id' = subscriptions.church_id::text);

CREATE POLICY "Super admins can insert subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Church admins can insert subscriptions for their church"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'church_id' = subscriptions.church_id::text);

CREATE POLICY "Super admins can update subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Church admins can update their church subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'church_id' = subscriptions.church_id::text)
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'church_id' = subscriptions.church_id::text);

CREATE POLICY "Super admins can delete subscriptions"
  ON subscriptions FOR DELETE
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Church admins can delete their church subscriptions"
  ON subscriptions FOR DELETE
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'church_id' = subscriptions.church_id::text);

-- ==================== ACTIVITY LOGS ====================

DROP POLICY IF EXISTS "Super admins can view all logs" ON activity_logs;
DROP POLICY IF EXISTS "Church admins can view their church logs" ON activity_logs;
DROP POLICY IF EXISTS "Admins can insert logs for their actions" ON activity_logs;

CREATE POLICY "Super admins can view all logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Church admins can view their church logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'church_id' = activity_logs.church_id::text);

CREATE POLICY "Admins can insert logs for their actions"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ==================== CHURCHES (fix anon access) ====================

DROP POLICY IF EXISTS "Authenticated users can view churches" ON churches;

CREATE POLICY "Anyone can view churches"
  ON churches FOR SELECT
  TO anon, authenticated
  USING (true);
