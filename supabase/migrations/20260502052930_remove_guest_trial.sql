/*
  # Remove guest trial feature

  ## Summary
  The guest trial feature has been removed from the app. This migration cleans up
  everything it required in the database.

  ## Changes

  ### Removed
  1. `guest_sessions` table - no longer needed
  2. `lookup_guest_session` function - no longer needed
  3. All anon SELECT grants on data tables (jobs, clients, parts, time_entries,
     business_details) - only needed for the guest flow
  4. All anon RLS policies on data tables

  ### Security improvement
  After this migration, the `anon` role has no SELECT access on any app data table.
  Only authenticated users can access data, gated by RLS policies.
  This eliminates all "Public Can See Object in GraphQL Schema" advisor warnings.
*/

-- Drop guest session lookup function
DROP FUNCTION IF EXISTS public.lookup_guest_session(uuid);

-- Drop guest_sessions table (and its policies via CASCADE)
DROP TABLE IF EXISTS public.guest_sessions CASCADE;

-- Revoke anon SELECT from all data tables
REVOKE SELECT ON public.jobs FROM anon;
REVOKE SELECT ON public.clients FROM anon;
REVOKE SELECT ON public.parts FROM anon;
REVOKE SELECT ON public.time_entries FROM anon;
REVOKE SELECT ON public.business_details FROM anon;

-- Drop the broad anon SELECT RLS policies that backed the guest flow
DROP POLICY IF EXISTS "Allow public read on jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow public read on clients" ON public.clients;
DROP POLICY IF EXISTS "Allow public read on parts" ON public.parts;
DROP POLICY IF EXISTS "Allow public read on time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Allow public read on business_details" ON public.business_details;
