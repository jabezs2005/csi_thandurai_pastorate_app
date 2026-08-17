/*
  # Fix duplicate foreign keys on activity_logs

  1. Problem
    - There are two FKs from activity_logs.church_id to churches(id):
      - activity_logs_church_id_fkey (original)
      - fk_activity_logs_church_id (added in previous migration)
    - This causes PGRST201 ambiguity error when PostgREST tries to resolve
      the join `church:churches(name)`
    - The admin_id FK points to auth.users instead of profiles, which also
      causes ambiguity with the new fk_activity_logs_admin_id FK

  2. Changes
    - Drop the duplicate fk_activity_logs_church_id constraint
    - Drop the original activity_logs_admin_id_fkey (points to auth.users)
    - Keep fk_activity_logs_admin_id (points to profiles - correct for join)
    - Keep activity_logs_church_id_fkey (original, points to churches)

  3. Security
    - No RLS changes
*/

ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS fk_activity_logs_church_id;
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_admin_id_fkey;
