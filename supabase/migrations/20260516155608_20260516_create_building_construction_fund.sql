/*
  # Create Building Construction Fund Table

  1. New Table
    - `building_construction_fund`
      - `id` (uuid, primary key)
      - `member_id` (uuid, FK to members)
      - `church_id` (uuid, FK to churches)
      - `year` (integer)
      - `month` (integer, 1-12)
      - `amount` (numeric, default 0)
      - `created_at` (timestamptz)

  2. Constraints
    - Unique on (member_id, year, month) to prevent duplicates
    - Foreign keys to members and churches

  3. Security
    - Enable RLS
    - Super admin can view/insert/update/delete all
    - Church admin can view/insert/update/delete for their church only
*/

CREATE TABLE IF NOT EXISTS building_construction_fund (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (member_id, year, month)
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_bcf_member_year ON building_construction_fund(member_id, year);
CREATE INDEX IF NOT EXISTS idx_bcf_church ON building_construction_fund(church_id);

-- Enable RLS
ALTER TABLE building_construction_fund ENABLE ROW LEVEL SECURITY;

-- RLS policies using SECURITY DEFINER helper functions
CREATE POLICY "Super admins can view all construction fund"
  ON building_construction_fund FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Church admins can view their church construction fund"
  ON building_construction_fund FOR SELECT
  TO authenticated
  USING (get_user_church_id(auth.uid()) = building_construction_fund.church_id);

CREATE POLICY "Super admins can insert construction fund"
  ON building_construction_fund FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Church admins can insert construction fund for their church"
  ON building_construction_fund FOR INSERT
  TO authenticated
  WITH CHECK (get_user_church_id(auth.uid()) = building_construction_fund.church_id);

CREATE POLICY "Super admins can update construction fund"
  ON building_construction_fund FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Church admins can update their church construction fund"
  ON building_construction_fund FOR UPDATE
  TO authenticated
  USING (get_user_church_id(auth.uid()) = building_construction_fund.church_id)
  WITH CHECK (get_user_church_id(auth.uid()) = building_construction_fund.church_id);

CREATE POLICY "Super admins can delete construction fund"
  ON building_construction_fund FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Church admins can delete their church construction fund"
  ON building_construction_fund FOR DELETE
  TO authenticated
  USING (get_user_church_id(auth.uid()) = building_construction_fund.church_id);
