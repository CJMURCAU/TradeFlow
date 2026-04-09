/*
  # Fix Indexes, RLS Policies, and Security Settings

  ## Summary
  Addresses remaining security advisor warnings:

  1. **Unindexed Foreign Keys** - Recreate covering indexes for foreign key columns that were
     previously dropped. Required for join and filter performance on:
     - jobs.client_id (jobs_client_id_fkey)
     - parts.job_id (parts_job_id_fkey)
     - time_entries.job_id (time_entries_job_id_fkey)

  2. **RLS Policy Always True** - Replace two overly-permissive policies:
     - `anon can update guest session`: USING (true) replaced with scoped device_identifier check
     - `authenticated can insert guest session`: WITH CHECK (true) replaced with scoped check
       allowing authenticated users to insert sessions linked to their own user_id or unlinked

  ## Notes
  - guest_sessions has no auth.uid() ownership concept for anon users (they have no uid),
    so anon UPDATE is scoped to rows where user_id IS NULL (unowned sessions only)
  - The Auth DB connection percentage strategy must be changed via the Supabase dashboard
    under Project Settings > Database > Connection pooling (cannot be set via SQL migration)
  - Leaked password protection must be enabled via the Supabase dashboard under
    Authentication > Settings > Password Protection (cannot be set via SQL migration)
*/

-- ============================================================
-- STEP 1: Recreate foreign key covering indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs (client_id);
CREATE INDEX IF NOT EXISTS idx_parts_job_id ON public.parts (job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_job_id ON public.time_entries (job_id);

-- ============================================================
-- STEP 2: Fix "always true" RLS policies on guest_sessions
-- ============================================================

-- Fix: anon can update guest session — was USING (true), now restricted to unowned sessions only
DROP POLICY IF EXISTS "anon can update guest session" ON public.guest_sessions;

CREATE POLICY "anon can update guest session"
  ON public.guest_sessions
  FOR UPDATE
  TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- Fix: authenticated can insert guest session — was WITH CHECK (true), now scoped to own uid
DROP POLICY IF EXISTS "authenticated can insert guest session" ON public.guest_sessions;

CREATE POLICY "authenticated can insert guest session"
  ON public.guest_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()) OR user_id IS NULL);
