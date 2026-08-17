/*
  # Fix Infinite Recursion in Profiles RLS Policies

  1. Problem
    - The "Super admins can view/update/delete all profiles" policies
      query the `profiles` table inside their own USING clause.
    - This creates infinite recursion: to check if a user is a super_admin,
      Postgres must evaluate the RLS policy on profiles, which again
      queries profiles, and so on.

  2. Solution
    - Drop the recursive policies that reference `profiles` in their own USING clause.
    - Replace them with policies that use `auth.jwt() -> 'app_metadata' ->> 'role'`
      to read the role from the JWT token's app_metadata instead.
    - The role is stored in `raw_app_meta_data` when a user signs up
      (via the `options: { data: { role } }` parameter), which Supabase
      copies into the JWT's app_metadata claim.
    - This avoids any self-referential query on the profiles table.

  3. Changes
    - Drop: "Super admins can view all profiles" (SELECT)
    - Drop: "Super admins can update all profiles" (UPDATE)
    - Drop: "Super admins can delete profiles" (DELETE)
    - Create new non-recursive equivalents using auth.jwt()
*/

-- Drop the recursive policies
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can delete profiles" ON profiles;

-- Create non-recursive replacements using JWT app_metadata
CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Super admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Super admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');
