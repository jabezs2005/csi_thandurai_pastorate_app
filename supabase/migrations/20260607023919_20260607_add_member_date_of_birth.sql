/*
# Add Date of Birth to Members

1. Changes
- Add `date_of_birth` (date, nullable) column to `members` table
- Allows church admins and super admins to record member DOB
*/

ALTER TABLE members ADD COLUMN IF NOT EXISTS date_of_birth date;
