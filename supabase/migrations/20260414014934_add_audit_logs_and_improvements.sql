/*
  # Add Activity Logs and Admin Actions Tracking

  ## Overview
  Adds a table to track all admin actions (create, update, delete) for audit purposes.
  Super admins can view all actions across all churches.

  ## Tables Created
  1. activity_logs - Tracks all admin actions with timestamps and details

  ## Indexes
  - For fast queries by church_id, admin_id, and created_at
*/

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  church_id uuid NOT NULL REFERENCES churches(id),
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  description text,
  changes jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_admin_idx ON activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS activity_logs_church_idx ON activity_logs(church_id);
CREATE INDEX IF NOT EXISTS activity_logs_created_idx ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_type_idx ON activity_logs(action_type, target_type);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Church admins can view their church logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.church_id = activity_logs.church_id
    )
  );

CREATE POLICY "Admins can insert logs for their actions"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (admin_id = auth.uid());
