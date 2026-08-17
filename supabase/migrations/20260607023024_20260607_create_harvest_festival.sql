/*
# Create Harvest Festival Table

1. New Tables
- `harvest_festival_items`
  - `id` (uuid, primary key)
  - `church_id` (uuid, not null, references churches) — which church this item belongs to
  - `item_name` (text, not null) — name of the item
  - `purchased_person` (text, not null) — name of the person who purchased
  - `amount` (numeric, not null) — total amount
  - `status` (text, not null default 'due') — 'paid' or 'due'
  - `settled_amount` (numeric, not null default 0) — amount settled so far
  - `pending_amount` (numeric, generated) — amount - settled_amount
  - `created_at` (timestamptz)

2. Security
- RLS enabled
- Super admins can CRUD all items
- Church admins can CRUD items for their own church
*/

CREATE TABLE IF NOT EXISTS harvest_festival_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  purchased_person text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'due',
  settled_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE harvest_festival_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view all harvest items" ON harvest_festival_items;
CREATE POLICY "Super admins can view all harvest items" ON harvest_festival_items FOR SELECT
  TO authenticated USING (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "Church admins can view own harvest items" ON harvest_festival_items;
CREATE POLICY "Church admins can view own harvest items" ON harvest_festival_items FOR SELECT
  TO authenticated USING (church_id = get_user_church_id(auth.uid()));

DROP POLICY IF EXISTS "Super admins can insert harvest items" ON harvest_festival_items;
CREATE POLICY "Super admins can insert harvest items" ON harvest_festival_items FOR INSERT
  TO authenticated WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "Church admins can insert own harvest items" ON harvest_festival_items;
CREATE POLICY "Church admins can insert own harvest items" ON harvest_festival_items FOR INSERT
  TO authenticated WITH CHECK (church_id = get_user_church_id(auth.uid()));

DROP POLICY IF EXISTS "Super admins can update harvest items" ON harvest_festival_items;
CREATE POLICY "Super admins can update harvest items" ON harvest_festival_items FOR UPDATE
  TO authenticated USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "Church admins can update own harvest items" ON harvest_festival_items;
CREATE POLICY "Church admins can update own harvest items" ON harvest_festival_items FOR UPDATE
  TO authenticated USING (church_id = get_user_church_id(auth.uid()))
  WITH CHECK (church_id = get_user_church_id(auth.uid()));

DROP POLICY IF EXISTS "Super admins can delete harvest items" ON harvest_festival_items;
CREATE POLICY "Super admins can delete harvest items" ON harvest_festival_items FOR DELETE
  TO authenticated USING (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "Church admins can delete own harvest items" ON harvest_festival_items;
CREATE POLICY "Church admins can delete own harvest items" ON harvest_festival_items FOR DELETE
  TO authenticated USING (church_id = get_user_church_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_harvest_church_id ON harvest_festival_items(church_id);
