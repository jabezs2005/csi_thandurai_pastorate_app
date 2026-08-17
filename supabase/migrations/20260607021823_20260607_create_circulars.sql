/*
# Create Circulars System

1. New Tables
- `circulars`
  - `id` (uuid, primary key)
  - `title` (text, not null) — subject of the circular
  - `content` (text) — text body
  - `voice_url` (text) — storage path to voice recording
  - `image_url` (text) — storage path to attached image
  - `document_url` (text) — storage path to attached document
  - `target_type` (text, not null) — 'all' for all churches, 'specific' for selected churches
  - `created_by` (uuid, not null) — the super admin who created it
  - `created_at` (timestamptz)

- `circular_churches` (join table for circular-to-church targeting)
  - `id` (uuid, primary key)
  - `circular_id` (uuid, not null, references circulars)
  - `church_id` (uuid, not null, references churches)
  - `read_at` (timestamptz) — when a church admin read the circular
  - UNIQUE constraint on (circular_id, church_id)

2. Storage
- Create `circulars` storage bucket for voice/image/document uploads (public read)

3. Security
- RLS enabled on both tables
- Super admins can CRUD circulars
- Church admins can view circulars targeted to their church
- Church admins can update read status on circular_churches
*/

-- Create tables first (without RLS policies that reference each other)
CREATE TABLE IF NOT EXISTS circulars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  voice_url text,
  image_url text,
  document_url text,
  target_type text NOT NULL DEFAULT 'all',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS circular_churches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circular_id uuid NOT NULL REFERENCES circulars(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  read_at timestamptz,
  UNIQUE (circular_id, church_id)
);

-- Enable RLS
ALTER TABLE circulars ENABLE ROW LEVEL SECURITY;
ALTER TABLE circular_churches ENABLE ROW LEVEL SECURITY;

-- Circulars policies
DROP POLICY IF EXISTS "Super admins can view all circulars" ON circulars;
CREATE POLICY "Super admins can view all circulars" ON circulars FOR SELECT
  TO authenticated USING (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "Church admins can view targeted circulars" ON circulars;
CREATE POLICY "Church admins can view targeted circulars" ON circulars FOR SELECT
  TO authenticated USING (
    get_user_role(auth.uid()) = 'church_admin'
    AND (
      target_type = 'all'
      OR EXISTS (
        SELECT 1 FROM circular_churches
        WHERE circular_churches.circular_id = circulars.id
        AND circular_churches.church_id = get_user_church_id(auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Super admins can insert circulars" ON circulars;
CREATE POLICY "Super admins can insert circulars" ON circulars FOR INSERT
  TO authenticated WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "Super admins can update circulars" ON circulars;
CREATE POLICY "Super admins can update circulars" ON circulars FOR UPDATE
  TO authenticated USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "Super admins can delete circulars" ON circulars;
CREATE POLICY "Super admins can delete circulars" ON circulars FOR DELETE
  TO authenticated USING (get_user_role(auth.uid()) = 'super_admin');

-- Circular_churches policies
DROP POLICY IF EXISTS "Super admins can view all circular_churches" ON circular_churches;
CREATE POLICY "Super admins can view all circular_churches" ON circular_churches FOR SELECT
  TO authenticated USING (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "Church admins can view own circular_churches" ON circular_churches;
CREATE POLICY "Church admins can view own circular_churches" ON circular_churches FOR SELECT
  TO authenticated USING (church_id = get_user_church_id(auth.uid()));

DROP POLICY IF EXISTS "Super admins can insert circular_churches" ON circular_churches;
CREATE POLICY "Super admins can insert circular_churches" ON circular_churches FOR INSERT
  TO authenticated WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "Church admins can update read status" ON circular_churches;
CREATE POLICY "Church admins can update read status" ON circular_churches FOR UPDATE
  TO authenticated USING (church_id = get_user_church_id(auth.uid()))
  WITH CHECK (church_id = get_user_church_id(auth.uid()));

DROP POLICY IF EXISTS "Super admins can delete circular_churches" ON circular_churches;
CREATE POLICY "Super admins can delete circular_churches" ON circular_churches FOR DELETE
  TO authenticated USING (get_user_role(auth.uid()) = 'super_admin');

-- Create storage bucket for circular attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('circulars', 'circulars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Authenticated users can upload circular files" ON storage.objects;
CREATE POLICY "Authenticated users can upload circular files" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'circulars');

DROP POLICY IF EXISTS "Anyone can view circular files" ON storage.objects;
CREATE POLICY "Anyone can view circular files" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'circulars');

DROP POLICY IF EXISTS "Authenticated users can delete circular files" ON storage.objects;
CREATE POLICY "Authenticated users can delete circular files" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'circulars');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_circulars_created_by ON circulars(created_by);
CREATE INDEX IF NOT EXISTS idx_circulars_created_at ON circulars(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circular_churches_church_id ON circular_churches(church_id);
CREATE INDEX IF NOT EXISTS idx_circular_churches_circular_id ON circular_churches(circular_id);
