/*
  # Add Service Role Policies for Edge Functions

  1. Changes
    - Add service role policies for password_reset_tokens table
    - Allows edge functions to create and manage password reset tokens
*/

-- Drop existing password reset token policies if needed
DROP POLICY IF EXISTS "Anyone can create reset tokens" ON password_reset_tokens;
DROP POLICY IF EXISTS "Users can update own reset tokens" ON password_reset_tokens;

-- Create new policies that allow service role
CREATE POLICY "Anyone can create reset tokens"
  ON password_reset_tokens FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

CREATE POLICY "Anyone can read reset tokens"
  ON password_reset_tokens FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

CREATE POLICY "Anyone can update reset tokens"
  ON password_reset_tokens FOR UPDATE
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Add service role policies to profiles for signup
DROP POLICY IF EXISTS "Service role can manage profiles" ON profiles;

CREATE POLICY "Service role can manage profiles"
  ON profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
