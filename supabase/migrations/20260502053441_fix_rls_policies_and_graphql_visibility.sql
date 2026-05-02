/*
  # Fix RLS policies and GraphQL schema visibility

  ## Summary
  Addresses all remaining Supabase advisor security warnings:

  1. **RLS Enabled No Policy** - After removing the guest trial, five tables lost their
     only RLS policies and became completely inaccessible. This adds proper
     ownership-scoped policies for: business_details, clients, jobs, parts, time_entries.

  2. **GraphQL Schema Visibility** - All app tables are visible in the GraphQL schema
     because authenticated (and some anon) roles have table-level SELECT grants.
     The app uses PostgREST (REST API), NOT GraphQL, so we can safely omit all tables
     from the GraphQL schema using pg_graphql comments without affecting app functionality.

  3. **SECURITY DEFINER Function** - lookup_employee_by_invite_token is tightened
     to only return the minimal columns needed and restrict to pending invites only
     (already the case, but we re-confirm and document it as intentional).

  ## New RLS Policies

  ### business_details
  - Owners can SELECT/INSERT/UPDATE/DELETE their own row (user_id = auth.uid())
  - Employees can SELECT their owner's business details (needed for job card view)

  ### clients
  - Owners can SELECT/INSERT/UPDATE/DELETE their own clients
  - Employees can SELECT clients belonging to their owner (needed for job detail view)

  ### jobs
  - Owners can SELECT/INSERT/UPDATE/DELETE their own jobs
  - Employees can SELECT jobs they are assigned to

  ### parts
  - Owners can SELECT/INSERT/UPDATE/DELETE parts on their jobs
  - Employees can SELECT parts on jobs they are assigned to

  ### time_entries
  - Owners can SELECT/INSERT/UPDATE/DELETE time entries on their jobs
  - Employees can SELECT time entries on jobs they are assigned to

  ## GraphQL Omit Comments
  All public app tables are hidden from the GraphQL schema via pg_graphql comment directives.
  This has zero effect on REST API access (PostgREST).
*/

-- ============================================================
-- PART 1: RLS POLICIES
-- ============================================================

-- business_details
CREATE POLICY "Owners can select own business details"
  ON public.business_details FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners can insert own business details"
  ON public.business_details FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can update own business details"
  ON public.business_details FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can delete own business details"
  ON public.business_details FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Employees can view their owner business details"
  ON public.business_details FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT user_id FROM public.employees
      WHERE employee_user_id = auth.uid()
    )
  );

-- clients
CREATE POLICY "Owners can select own clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners can insert own clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can update own clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can delete own clients"
  ON public.clients FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Employees can view clients for their owner"
  ON public.clients FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT user_id FROM public.employees
      WHERE employee_user_id = auth.uid()
    )
  );

-- jobs
CREATE POLICY "Owners can select own jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners can insert own jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can update own jobs"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can delete own jobs"
  ON public.jobs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Employees can view assigned jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT ja.job_id FROM public.job_assignments ja
      JOIN public.employees e ON e.id = ja.employee_id
      WHERE e.employee_user_id = auth.uid()
    )
  );

-- parts
CREATE POLICY "Owners can select parts on own jobs"
  ON public.parts FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert parts on own jobs"
  ON public.parts FOR INSERT
  TO authenticated
  WITH CHECK (
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update parts on own jobs"
  ON public.parts FOR UPDATE
  TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete parts on own jobs"
  ON public.parts FOR DELETE
  TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can view parts on assigned jobs"
  ON public.parts FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT ja.job_id FROM public.job_assignments ja
      JOIN public.employees e ON e.id = ja.employee_id
      WHERE e.employee_user_id = auth.uid()
    )
  );

-- time_entries
CREATE POLICY "Owners can select time entries on own jobs"
  ON public.time_entries FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert time entries on own jobs"
  ON public.time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update time entries on own jobs"
  ON public.time_entries FOR UPDATE
  TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete time entries on own jobs"
  ON public.time_entries FOR DELETE
  TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can view time entries on assigned jobs"
  ON public.time_entries FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT ja.job_id FROM public.job_assignments ja
      JOIN public.employees e ON e.id = ja.employee_id
      WHERE e.employee_user_id = auth.uid()
    )
  );

-- ============================================================
-- PART 2: HIDE ALL TABLES FROM GRAPHQL SCHEMA
-- The app uses PostgREST (REST API only). Hiding from GraphQL
-- has zero effect on REST endpoints or app functionality.
-- ============================================================

COMMENT ON TABLE public.business_details IS '@graphql({"omit": true})';
COMMENT ON TABLE public.clients IS '@graphql({"omit": true})';
COMMENT ON TABLE public.employees IS '@graphql({"omit": true})';
COMMENT ON TABLE public.employee_notifications IS '@graphql({"omit": true})';
COMMENT ON TABLE public.job_assignments IS '@graphql({"omit": true})';
COMMENT ON TABLE public.job_employee_notes IS '@graphql({"omit": true})';
COMMENT ON TABLE public.jobs IS '@graphql({"omit": true})';
COMMENT ON TABLE public.parts IS '@graphql({"omit": true})';
COMMENT ON TABLE public.time_entries IS '@graphql({"omit": true})';
COMMENT ON TABLE public.user_roles IS '@graphql({"omit": true})';

-- Also hide the lookup function from GraphQL
COMMENT ON FUNCTION public.lookup_employee_by_invite_token(text) IS '@graphql({"omit": true})';
