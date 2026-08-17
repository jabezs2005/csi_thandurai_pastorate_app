/*
  # Update All RLS Policies to Use Helper Functions

  1. Summary
    - Replace all auth.jwt() -> 'app_metadata' checks with SECURITY DEFINER
      helper function calls (get_user_role, get_user_church_id, is_approved_user).
    - This fixes the issue where JWT app_metadata is stale or missing.
    - Helper functions query profiles directly but bypass RLS, avoiding recursion.

  2. Tables Updated
    - profiles
    - members
    - subscriptions
    - activity_logs
    - churches
*/

-- ==================== PROFILES ====================

DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Super admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

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
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Church admins can view their church members"
  ON members FOR SELECT
  TO authenticated
  USING (get_user_church_id(auth.uid()) = members.church_id);

CREATE POLICY "Super admins can insert members"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Church admins can insert members for their church"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (get_user_church_id(auth.uid()) = members.church_id);

CREATE POLICY "Super admins can update members"
  ON members FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Church admins can update their church members"
  ON members FOR UPDATE
  TO authenticated
  USING (get_user_church_id(auth.uid()) = members.church_id)
  WITH CHECK (get_user_church_id(auth.uid()) = members.church_id);

CREATE POLICY "Super admins can delete members"
  ON members FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Church admins can delete their church members"
  ON members FOR DELETE
  TO authenticated
  USING (get_user_church_id(auth.uid()) = members.church_id);

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
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Church admins can view their church subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (get_user_church_id(auth.uid()) = subscriptions.church_id);

CREATE POLICY "Super admins can insert subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Church admins can insert subscriptions for their church"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (get_user_church_id(auth.uid()) = subscriptions.church_id);

CREATE POLICY "Super admins can update subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Church admins can update their church subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (get_user_church_id(auth.uid()) = subscriptions.church_id)
  WITH CHECK (get_user_church_id(auth.uid()) = subscriptions.church_id);

CREATE POLICY "Super admins can delete subscriptions"
  ON subscriptions FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Church admins can delete their church subscriptions"
  ON subscriptions FOR DELETE
  TO authenticated
  USING (get_user_church_id(auth.uid()) = subscriptions.church_id);

-- ==================== ACTIVITY LOGS ====================

DROP POLICY IF EXISTS "Super admins can view all logs" ON activity_logs;
DROP POLICY IF EXISTS "Church admins can view their church logs" ON activity_logs;
DROP POLICY IF EXISTS "Admins can insert logs for their actions" ON activity_logs;

CREATE POLICY "Super admins can view all logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Church admins can view their church logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (get_user_church_id(auth.uid()) = activity_logs.church_id);

CREATE POLICY "Admins can insert logs for their actions"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ==================== CHURCHES ====================

DROP POLICY IF EXISTS "Super admins can insert churches" ON churches;
DROP POLICY IF EXISTS "Super admins can update churches" ON churches;
DROP POLICY IF EXISTS "Anyone can view churches" ON churches;

CREATE POLICY "Anyone can view churches"
  ON churches FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Super admins can insert churches"
  ON churches FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Super admins can update churches"
  ON churches FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');
