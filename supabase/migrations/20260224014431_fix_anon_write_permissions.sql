/*
  # Fix anon write permissions for all tables

  ## Problem
  The app uses the anonymous Supabase key with no authentication (persistSession: false),
  but all write policies (INSERT, UPDATE, DELETE) were restricted to the `authenticated` role.
  This caused all create/update/delete operations to silently fail with a permissions error.

  ## Changes
  - Drop the existing write-only authenticated policies on all tables
  - Add new policies allowing the `anon` role to perform ALL operations
  - This is appropriate for a single-user tradesman app with no auth system

  ## Tables affected
  - clients
  - jobs
  - parts
  - time_entries
  - business_details
*/

-- clients
DROP POLICY IF EXISTS "Allow all operations on clients" ON clients;
CREATE POLICY "Allow anon all operations on clients"
  ON clients FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- jobs
DROP POLICY IF EXISTS "Allow all operations on jobs" ON jobs;
CREATE POLICY "Allow anon all operations on jobs"
  ON jobs FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- parts
DROP POLICY IF EXISTS "Allow all operations on parts" ON parts;
CREATE POLICY "Allow anon all operations on parts"
  ON parts FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- time_entries
DROP POLICY IF EXISTS "Allow all operations on time_entries" ON time_entries;
CREATE POLICY "Allow anon all operations on time_entries"
  ON time_entries FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- business_details
DROP POLICY IF EXISTS "Allow all operations on business_details" ON business_details;
CREATE POLICY "Allow anon all operations on business_details"
  ON business_details FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
