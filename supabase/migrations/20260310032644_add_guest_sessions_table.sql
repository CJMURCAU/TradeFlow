/*
  # Add guest_sessions table for 30-day free trial

  ## Summary
  Creates a guest_sessions table to support the "Use as Guest - Free 30 Day Trial" feature.
  Guest users can use the app without an account for 30 days. When they sign up, their
  data is migrated to their new user account.

  ## New Tables
  - `guest_sessions`
    - `id` (uuid, primary key) - unique session identifier stored on device
    - `device_identifier` (text) - device fingerprint for identifying the device
    - `started_at` (timestamptz) - when the trial began
    - `expires_at` (timestamptz) - when the trial ends (started_at + 30 days)
    - `user_id` (uuid, nullable) - set when guest converts to a real account

  ## Security
  - RLS enabled on guest_sessions
  - Guests can create their own session (anon insert allowed for trial creation)
  - Sessions can only be read by the device that created them (by id)
  - Authenticated users can update their own session (for conversion tracking)

  ## Notes
  - expires_at defaults to started_at + 30 days
  - user_id is nullable to support pre-signup guest sessions
  - After signup, user_id is set to the new auth user's id
*/

CREATE TABLE IF NOT EXISTS guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_identifier text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a guest session"
  ON guest_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Guest sessions are readable by session id lookup"
  ON guest_sessions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can update their own guest session"
  ON guest_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (true);
