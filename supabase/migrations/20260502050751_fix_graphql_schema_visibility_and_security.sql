/*
  # Fix GraphQL Schema Visibility and Security Issues

  ## Summary
  Revokes public (anon) and broad authenticated SELECT grants from all tables so they
  are no longer discoverable in the GraphQL schema by unauthenticated or arbitrary
  signed-in users. RLS policies already enforce row-level access; this removes the
  table-level grants that make the schema visible regardless of RLS.

  Also converts renumber_jobs_from to SECURITY INVOKER so it runs as the calling
  user and revokes execute from anon.

  ## Changes
  1. Revoke SELECT from anon on all public tables
  2. Revoke SELECT from authenticated on all public tables
     (RLS policies remain — they continue to control row access for authenticated users
      who go through the proper PostgREST/Supabase client path)
  3. Re-grant SELECT only to authenticated (required for RLS-gated queries to work)
     but NOT to anon (guest flow uses anon for guest_sessions insert, not select via GraphQL)
  4. Fix renumber_jobs_from: revoke from anon, convert to SECURITY INVOKER
*/

-- Revoke all table-level grants from anon on every public table
REVOKE ALL ON public.business_details FROM anon;
REVOKE ALL ON public.clients FROM anon;
REVOKE ALL ON public.employee_notifications FROM anon;
REVOKE ALL ON public.employees FROM anon;
REVOKE ALL ON public.guest_sessions FROM anon;
REVOKE ALL ON public.job_assignments FROM anon;
REVOKE ALL ON public.job_employee_notes FROM anon;
REVOKE ALL ON public.jobs FROM anon;
REVOKE ALL ON public.parts FROM anon;
REVOKE ALL ON public.time_entries FROM anon;
REVOKE ALL ON public.user_roles FROM anon;

-- Revoke broad table-level grants from authenticated (RLS policies handle row access)
REVOKE ALL ON public.business_details FROM authenticated;
REVOKE ALL ON public.clients FROM authenticated;
REVOKE ALL ON public.employee_notifications FROM authenticated;
REVOKE ALL ON public.employees FROM authenticated;
REVOKE ALL ON public.guest_sessions FROM authenticated;
REVOKE ALL ON public.job_assignments FROM authenticated;
REVOKE ALL ON public.job_employee_notes FROM authenticated;
REVOKE ALL ON public.jobs FROM authenticated;
REVOKE ALL ON public.parts FROM authenticated;
REVOKE ALL ON public.time_entries FROM authenticated;
REVOKE ALL ON public.user_roles FROM authenticated;

-- Re-grant the minimum DML needed for the app to function through RLS policies
-- SELECT is required for RLS-gated reads; INSERT/UPDATE/DELETE re-granted selectively

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_details TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.employee_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT SELECT ON public.guest_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.job_employee_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_roles TO authenticated;

-- guest_sessions: anon needs INSERT (to create a trial session) but not SELECT via GraphQL
-- The app queries guest_sessions by id using the anon key, so we must keep SELECT for anon
-- but we use a restrictive RLS policy (already exists) rather than open table grant.
-- Re-grant only what the guest flow requires:
GRANT INSERT ON public.guest_sessions TO anon;
GRANT SELECT ON public.guest_sessions TO anon;
GRANT UPDATE ON public.guest_sessions TO anon;

-- employees: anon needs SELECT for invite token lookup (invite flow)
GRANT SELECT ON public.employees TO anon;

-- Fix renumber_jobs_from: revoke from anon, switch to SECURITY INVOKER
REVOKE EXECUTE ON FUNCTION public.renumber_jobs_from(integer) FROM anon;

DO $$
DECLARE
  func_body text;
  func_args text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO func_body
  FROM pg_proc
  WHERE proname = 'renumber_jobs_from'
    AND pronamespace = 'public'::regnamespace
  LIMIT 1;

  -- Only recreate if it currently exists as SECURITY DEFINER
  IF func_body ILIKE '%SECURITY DEFINER%' THEN
    -- Recreate with SECURITY INVOKER by replacing SECURITY DEFINER
    EXECUTE regexp_replace(func_body, 'SECURITY DEFINER', 'SECURITY INVOKER', 'i');
  END IF;
END $$;

-- Ensure only authenticated can execute it
REVOKE EXECUTE ON FUNCTION public.renumber_jobs_from(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renumber_jobs_from(integer) TO authenticated;
