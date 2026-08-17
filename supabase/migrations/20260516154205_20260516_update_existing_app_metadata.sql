/*
  # Update Existing Users' App Metadata for RLS

  1. Problem
    - Existing users in auth.users don't have role/church_id in app_metadata.
    - The new RLS policies rely on auth.jwt() -> 'app_metadata' for role and church_id.
    - Without this, existing users can't access any data.

  2. Solution
    - Use a PL/pgSQL function to update app_metadata for all existing users
      based on their profiles table data.
    - This is a one-time migration to fix existing accounts.
*/

DO $$
DECLARE
  user_record RECORD;
  profile_record RECORD;
BEGIN
  FOR user_record IN SELECT id, email FROM auth.users LOOP
    SELECT role, church_id, is_approved INTO profile_record
    FROM profiles WHERE id = user_record.id;

    IF profile_record IS NOT NULL THEN
      UPDATE auth.users
      SET raw_app_meta_data = jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(raw_app_meta_data, '{}'::jsonb),
            '{role}',
            to_jsonb(profile_record.role)
          ),
          '{church_id}',
          CASE WHEN profile_record.church_id IS NOT NULL
            THEN to_jsonb(profile_record.church_id::text)
            ELSE 'null'::jsonb
          END
        ),
        '{is_approved}',
        to_jsonb(COALESCE(profile_record.is_approved, false))
      )
      WHERE id = user_record.id;
    END IF;
  END LOOP;
END $$;
