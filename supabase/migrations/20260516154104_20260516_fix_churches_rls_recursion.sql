/*
  # Fix RLS Recursion in Churches Table Policies

  1. Problem
    - "Super admins can insert churches" and "Super admins can update churches"
      policies reference the `profiles` table in their USING/WITH CHECK clauses.
    - This causes infinite recursion because the profiles table RLS policies
      may also reference churches.

  2. Solution
    - Replace profile-based checks with auth.jwt() app_metadata role checks.
    - This avoids any cross-table references in RLS policies.
*/

DROP POLICY IF EXISTS "Super admins can insert churches" ON churches;
DROP POLICY IF EXISTS "Super admins can update churches" ON churches;

CREATE POLICY "Super admins can insert churches"
  ON churches FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Super admins can update churches"
  ON churches FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');
