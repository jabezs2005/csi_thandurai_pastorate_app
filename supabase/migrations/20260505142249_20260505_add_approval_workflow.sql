/*
  # Add Account Approval Workflow

  1. Changes
    - Add approval status to profiles table
    - Add approval tracking fields
    - Add password reset tokens table for forgot password flow
    
  2. New Columns in profiles
    - `is_approved` (boolean, default false) - Super admin approval status
    - `approved_by` (uuid, nullable) - Super admin who approved
    - `approved_at` (timestamptz, nullable) - When approval happened
    
  3. New Tables
    - `password_reset_tokens`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - Reference to auth user
      - `email` (text) - User email
      - `token` (text, unique) - Reset token
      - `expires_at` (timestamptz) - Token expiry time
      - `used_at` (timestamptz, nullable) - When token was used
      - `created_at` (timestamptz)
      
  4. Security
    - Enable RLS on password_reset_tokens
    - Add policies for token management
*/

-- Add approval fields to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_approved'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_approved boolean DEFAULT false;
    ALTER TABLE profiles ADD COLUMN approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    ALTER TABLE profiles ADD COLUMN approved_at timestamptz;
  END IF;
END $$;

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on password_reset_tokens
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create reset tokens (public)
CREATE POLICY "Anyone can create reset tokens"
  ON password_reset_tokens FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow updating own reset tokens (marking as used)
CREATE POLICY "Users can update own reset tokens"
  ON password_reset_tokens FOR UPDATE
  TO anon, authenticated
  USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
