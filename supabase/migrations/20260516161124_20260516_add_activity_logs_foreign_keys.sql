/*
  # Add foreign keys to activity_logs

  1. Changes
    - Add foreign key from `activity_logs.admin_id` to `profiles(id)` 
    - Add foreign key from `activity_logs.church_id` to `churches(id)`
  
  2. Purpose
    - PostgREST requires foreign key relationships to resolve join queries
      like `admin:profiles(full_name,email)` and `church:churches(name)`
    - Without these FKs, the Activity Logs page fails with PGRST200 error

  3. Security
    - No RLS changes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'activity_logs' AND ccu.column_name = 'admin_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE activity_logs
      ADD CONSTRAINT fk_activity_logs_admin_id
      FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'activity_logs' AND ccu.column_name = 'church_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE activity_logs
      ADD CONSTRAINT fk_activity_logs_church_id
      FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE SET NULL;
  END IF;
END $$;
