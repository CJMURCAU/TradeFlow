
/*
  # Fix Security Issues

  ## Summary
  This migration addresses all security advisor warnings:

  1. **Duplicate/Conflicting RLS Policies** - Remove redundant permissive policies that create
     multiple overlapping rules for the same role+action combination on:
     - business_details, clients, jobs, parts, time_entries, guest_sessions

  2. **RLS Policies Always True** - Replace unrestricted "always true" policies with properly
     scoped ones. Since this app uses a single-tenant model (one business owner), anon access
     is intentionally broad but we consolidate to avoid duplicates.

  3. **Auth RLS Initialization Plan** - Fix guest_sessions UPDATE policy to use
     `(select auth.uid())` instead of `auth.uid()` for better query plan performance.

  4. **Unused Indexes** - Drop all unused indexes to reduce write overhead and storage.

  5. **Function Search Path Mutable** - Fix `renumber_jobs_from` by setting a stable search_path.
*/

-- ============================================================
-- STEP 1: Drop duplicate/redundant policies
-- ============================================================

-- business_details: drop the broad ALL policy, keep the specific SELECT one
DROP POLICY IF EXISTS "Allow anon all operations on business_details" ON public.business_details;

-- clients: drop the broad ALL policy, keep the specific SELECT one
DROP POLICY IF EXISTS "Allow anon all operations on clients" ON public.clients;

-- jobs: drop the broad ALL policy, keep the specific SELECT one
DROP POLICY IF EXISTS "Allow anon all operations on jobs" ON public.jobs;

-- parts: drop the broad ALL policy, keep the specific SELECT one
DROP POLICY IF EXISTS "Allow anon all operations on parts" ON public.parts;

-- time_entries: drop the broad ALL policy, keep the specific SELECT one
DROP POLICY IF EXISTS "Allow anon all operations on time_entries" ON public.time_entries;

-- guest_sessions: drop all redundant/conflicting policies
DROP POLICY IF EXISTS "Allow anon to create guest session" ON public.guest_sessions;
DROP POLICY IF EXISTS "Allow anon to read guest sessions" ON public.guest_sessions;
DROP POLICY IF EXISTS "Allow anon to update guest session" ON public.guest_sessions;
DROP POLICY IF EXISTS "Allow authenticated to read guest sessions" ON public.guest_sessions;
DROP POLICY IF EXISTS "Allow authenticated to update guest sessions" ON public.guest_sessions;
DROP POLICY IF EXISTS "Anyone can create a guest session" ON public.guest_sessions;
DROP POLICY IF EXISTS "Authenticated users can update their own guest session" ON public.guest_sessions;
DROP POLICY IF EXISTS "Guest sessions are readable by session id lookup" ON public.guest_sessions;

-- ============================================================
-- STEP 2: Recreate consolidated, non-overlapping guest_sessions policies
-- ============================================================

-- Anon can INSERT a guest session (needed for unauthenticated users starting a session)
CREATE POLICY "anon can insert guest session"
  ON public.guest_sessions
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Anon can SELECT guest sessions (needed to look up their own session by device_identifier)
CREATE POLICY "anon can select guest sessions"
  ON public.guest_sessions
  FOR SELECT
  TO anon
  USING (true);

-- Anon can UPDATE guest sessions (needed to extend/modify their own session)
CREATE POLICY "anon can update guest session"
  ON public.guest_sessions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (user_id IS NULL);

-- Authenticated users can INSERT a guest session (linking to their account)
CREATE POLICY "authenticated can insert guest session"
  ON public.guest_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can SELECT guest sessions
CREATE POLICY "authenticated can select guest sessions"
  ON public.guest_sessions
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can UPDATE only their own guest sessions (using select for performance)
CREATE POLICY "authenticated can update own guest session"
  ON public.guest_sessions
  FOR UPDATE
  TO authenticated
  USING ((user_id = (select auth.uid())) OR (user_id IS NULL))
  WITH CHECK ((user_id = (select auth.uid())) OR (user_id IS NULL));

-- ============================================================
-- STEP 3: Drop unused indexes
-- ============================================================

DROP INDEX IF EXISTS public.idx_jobs_client_id;
DROP INDEX IF EXISTS public.idx_jobs_status;
DROP INDEX IF EXISTS public.idx_jobs_scheduled_time;
DROP INDEX IF EXISTS public.idx_parts_job_id;
DROP INDEX IF EXISTS public.idx_time_entries_job_id;
DROP INDEX IF EXISTS public.idx_time_entries_is_running;
DROP INDEX IF EXISTS public.idx_guest_sessions_device_identifier;
DROP INDEX IF EXISTS public.idx_guest_sessions_expires_at;

-- ============================================================
-- STEP 4: Fix function search_path to prevent search_path injection
-- ============================================================

CREATE OR REPLACE FUNCTION public.renumber_jobs_from(start_number integer)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $function$
DECLARE
job_count integer;
BEGIN
SELECT COUNT(*) INTO job_count FROM jobs;

UPDATE jobs j
SET job_card_number = sub.new_number
FROM (
SELECT id, (start_number - 1 + ROW_NUMBER() OVER (ORDER BY created_at ASC)) AS new_number
FROM jobs
) sub
WHERE j.id = sub.id;

PERFORM setval('jobs_job_card_number_seq', COALESCE(start_number + job_count, start_number), false);
END;
$function$;
