/*
# Add read_by tracking to circular_churches

1. Changes
- Add `read_by` (uuid, nullable) column to circular_churches
  - Tracks which specific user marked the circular as read
- Add `read_by_name` convenience: we'll join to profiles for the name
*/

ALTER TABLE circular_churches ADD COLUMN IF NOT EXISTS read_by uuid;

-- Add RLS update policy for circular_churches so church admins can mark as read
-- (The current update policy may not exist or may be too restrictive)
DROP POLICY IF EXISTS "Church admins can update own circular_churches" ON circular_churches;
CREATE POLICY "Church admins can update own circular_churches" ON circular_churches FOR UPDATE
  TO authenticated USING (church_id = get_user_church_id(auth.uid()))
  WITH CHECK (church_id = get_user_church_id(auth.uid()));
