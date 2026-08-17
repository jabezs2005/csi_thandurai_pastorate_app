/*
  # Make activity_logs.church_id nullable

  1. Problem
    - Super admins may not belong to a specific church (church_id is null in profiles)
    - The activity_logs.church_id column is NOT NULL, causing insert failures
      when logging super_admin actions that aren't tied to a church
    - Using a placeholder UUID '00000000-0000-0000-0000-000000000000' is a workaround
      but nullable is the correct schema design

  2. Changes
    - Alter activity_logs.church_id to allow NULL values

  3. Security
    - No RLS changes
*/

ALTER TABLE activity_logs ALTER COLUMN church_id DROP NOT NULL;
