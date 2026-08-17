/*
  # Church Membership and Subscription Management System

  ## Overview
  Full schema for managing church members, subscriptions, and admin roles across 6 church branches.
  Tables are created first, then RLS policies are applied after all tables exist (avoiding circular deps).

  ## Tables
  1. churches - 6 church branches
  2. profiles - admin users (super_admin, church_admin)
  3. members - church members grouped by family_number
  4. subscriptions - monthly contribution records
*/

-- =====================
-- CREATE ALL TABLES FIRST
-- =====================

CREATE TABLE IF NOT EXISTS churches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  location text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  mobile text,
  role text NOT NULL DEFAULT 'church_admin' CHECK (role IN ('super_admin', 'church_admin')),
  church_id uuid REFERENCES churches(id),
  full_name text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id),
  family_number text NOT NULL,
  member_name text NOT NULL,
  address text DEFAULT '',
  email text DEFAULT '',
  mobile text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS members_church_id_idx ON members(church_id);
CREATE INDEX IF NOT EXISTS members_family_number_idx ON members(family_number);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES churches(id),
  year int NOT NULL,
  month int NOT NULL CHECK (month >= 1 AND month <= 12),
  sandha numeric DEFAULT 0,
  kattida_nidhi numeric DEFAULT 0,
  aalaya_paraamarippu numeric DEFAULT 0,
  narseidhi_thiruppani numeric DEFAULT 0,
  yezhaiyar_nidhi numeric DEFAULT 0,
  pengal_thiruppani numeric DEFAULT 0,
  aangal_thiruppani numeric DEFAULT 0,
  ilainyar_thiruppani numeric DEFAULT 0,
  siruvar_thiruppani numeric DEFAULT 0,
  girama_nidhi numeric DEFAULT 0,
  kalvi_nidhi numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(member_id, year, month)
);

CREATE INDEX IF NOT EXISTS subscriptions_member_id_idx ON subscriptions(member_id);
CREATE INDEX IF NOT EXISTS subscriptions_church_id_idx ON subscriptions(church_id);

-- =====================
-- ENABLE RLS ON ALL TABLES
-- =====================

ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- =====================
-- CHURCHES POLICIES
-- =====================

CREATE POLICY "Authenticated users can view churches"
  ON churches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can insert churches"
  ON churches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

CREATE POLICY "Super admins can update churches"
  ON churches FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

-- =====================
-- PROFILES POLICIES
-- =====================

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'super_admin')
  );

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'super_admin'));

CREATE POLICY "Super admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'super_admin'));

-- =====================
-- MEMBERS POLICIES
-- =====================

CREATE POLICY "Super admins can view all members"
  ON members FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Church admins can view their church members"
  ON members FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.church_id = members.church_id)
  );

CREATE POLICY "Super admins can insert members"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Church admins can insert members for their church"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.church_id = members.church_id)
  );

CREATE POLICY "Super admins can update members"
  ON members FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Church admins can update their church members"
  ON members FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.church_id = members.church_id))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.church_id = members.church_id));

CREATE POLICY "Super admins can delete members"
  ON members FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Church admins can delete their church members"
  ON members FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.church_id = members.church_id)
  );

-- =====================
-- SUBSCRIPTIONS POLICIES
-- =====================

CREATE POLICY "Super admins can view all subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Church admins can view their church subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.church_id = subscriptions.church_id)
  );

CREATE POLICY "Super admins can insert subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Church admins can insert subscriptions for their church"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.church_id = subscriptions.church_id)
  );

CREATE POLICY "Super admins can update subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Church admins can update their church subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.church_id = subscriptions.church_id))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.church_id = subscriptions.church_id));

CREATE POLICY "Super admins can delete subscriptions"
  ON subscriptions FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Church admins can delete their church subscriptions"
  ON subscriptions FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.church_id = subscriptions.church_id)
  );

-- =====================
-- SEED DATA: 6 CHURCHES
-- =====================

INSERT INTO churches (name, location) VALUES
  ('St. Mary''s Church', 'Chennai Central'),
  ('St. John''s Church', 'Coimbatore'),
  ('St. Peter''s Church', 'Madurai'),
  ('St. Paul''s Church', 'Trichy'),
  ('St. Thomas Church', 'Salem'),
  ('St. Andrew''s Church', 'Tirunelveli')
ON CONFLICT (name) DO NOTHING;
