/*
# Fix Circulars: Profile read access + auto-create circular_churches for 'all' target

1. Problem 1: Church admins cannot see circulars because the query joins to 
   profiles (for creator name) and profiles RLS only allows users to see their 
   own profile. The join fails RLS and the entire circulars query returns nothing.

2. Fix 1: Add a SELECT policy on profiles allowing authenticated users to read
   basic profile info (id, full_name) needed for circular display.

3. Problem 2: When target_type = 'all', no circular_churches rows are created,
   so church admins cannot mark circulars as read (no row to update).

4. Fix 2: Add a trigger that automatically creates circular_churches rows for
   all churches when a circular with target_type = 'all' is inserted.
*/

-- Fix 1: Allow authenticated users to read profiles (for circular creator display)
DROP POLICY IF EXISTS "Authenticated users can view profile basics" ON profiles;
CREATE POLICY "Authenticated users can view profile basics" ON profiles FOR SELECT
  TO authenticated USING (true);

-- Fix 2: Create trigger function to auto-populate circular_churches for 'all' target
CREATE OR REPLACE FUNCTION create_circular_churches_for_all()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.target_type = 'all' THEN
    INSERT INTO circular_churches (circular_id, church_id)
    SELECT NEW.id, id FROM churches
    ON CONFLICT (circular_id, church_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_create_circular_churches ON circulars;
CREATE TRIGGER trg_create_circular_churches
  AFTER INSERT ON circulars
  FOR EACH ROW
  EXECUTE FUNCTION create_circular_churches_for_all();

-- Backfill existing 'all' circulars that don't have circular_churches entries
INSERT INTO circular_churches (circular_id, church_id)
SELECT c.id, ch.id
FROM circulars c
CROSS JOIN churches ch
WHERE c.target_type = 'all'
ON CONFLICT (circular_id, church_id) DO NOTHING;
