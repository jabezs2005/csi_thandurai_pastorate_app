/*
  # Create Security Definer Helper Functions for RLS

  1. Problem
    - RLS policies using auth.jwt() -> 'app_metadata' fail when:
      a) The JWT is stale (app_metadata updated after login)
      b) The app_metadata was never set for older users
    - RLS policies referencing profiles directly cause infinite recursion

  2. Solution
    - Create SECURITY DEFINER functions that run with the function owner's
      privileges (typically superuser), bypassing RLS.
    - These functions can safely query the profiles table without recursion.
    - RLS policies call these functions instead of querying profiles directly
      or relying on JWT app_metadata.
    - This is the recommended Supabase pattern for avoiding RLS recursion.

  3. Functions Created
    - get_user_role(uuid) -> text: Returns the user's role from profiles
    - get_user_church_id(uuid) -> uuid: Returns the user's church_id from profiles
    - is_approved_user(uuid) -> boolean: Returns whether the user is approved
*/

-- Function to get a user's role (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$;

-- Function to get a user's church_id (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_user_church_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT church_id FROM profiles WHERE id = user_id;
$$;

-- Function to check if a user is approved (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION is_approved_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(is_approved, false) FROM profiles WHERE id = user_id;
$$;

-- Revoke public execute, grant only to authenticated users
REVOKE EXECUTE ON FUNCTION get_user_role(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION get_user_church_id(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION is_approved_user(uuid) FROM public;
GRANT EXECUTE ON FUNCTION get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_church_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_approved_user(uuid) TO authenticated;
