-- ============================================================================
-- Fix security alerts: GraphQL visibility, function search paths,
-- function execute grants, job_inventory RLS, storage bucket listing
-- ============================================================================

-- 1. Revoke anon SELECT from tables that should require authentication
--    This hides them from the GraphQL schema for unauthenticated users.
REVOKE SELECT ON client_contacts FROM anon;
REVOKE SELECT ON inventory_catalogue FROM anon;
REVOKE SELECT ON job_inventory FROM anon;
REVOKE SELECT ON job_photos FROM anon;
REVOKE SELECT ON note_items FROM anon;

-- 2. Fix function search_path (mutable search_path warnings)
ALTER FUNCTION public.next_job_card_number(owner_user_id uuid)
  SECURITY DEFINER SET search_path = public;

ALTER FUNCTION public.check_job_photo_limit()
  SECURITY DEFINER SET search_path = public;

-- 3. Restrict next_job_card_number to authenticated users only
--    (accept_employee_invite and lookup_employee_by_invite_token
--     must remain callable by anon for the invite flow to work)
REVOKE EXECUTE ON FUNCTION public.next_job_card_number(owner_user_id uuid) FROM anon;

-- 4. Fix job_inventory RLS policies
--    Currently all policies use USING(true) / WITH CHECK(true), meaning
--    ANY authenticated user can read/insert/update/delete inventory on
--    ANY job in the system. Scope to job ownership + employee assignment,
--    mirroring the existing jobs table policies.

-- Drop the overly permissive policies
DROP POLICY IF EXISTS auth_select_job_inventory ON job_inventory;
DROP POLICY IF EXISTS auth_insert_job_inventory ON job_inventory;
DROP POLICY IF EXISTS auth_update_job_inventory ON job_inventory;
DROP POLICY IF EXISTS auth_delete_job_inventory ON job_inventory;

-- SELECT: owners can see inventory on their own jobs; employees on assigned jobs
CREATE POLICY "auth_select_job_inventory" ON job_inventory
  FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT jobs.id FROM jobs
      WHERE jobs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN employees e ON e.id = ja.employee_id
      WHERE ja.job_id = job_inventory.job_id
        AND e.employee_user_id = auth.uid()
    )
  );

-- INSERT: owners can add inventory to their own jobs; employees to assigned jobs
CREATE POLICY "auth_insert_job_inventory" ON job_inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    job_id IN (
      SELECT jobs.id FROM jobs
      WHERE jobs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN employees e ON e.id = ja.employee_id
      WHERE ja.job_id = job_inventory.job_id
        AND e.employee_user_id = auth.uid()
    )
  );

-- UPDATE: same scoping
CREATE POLICY "auth_update_job_inventory" ON job_inventory
  FOR UPDATE TO authenticated
  USING (
    job_id IN (
      SELECT jobs.id FROM jobs
      WHERE jobs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN employees e ON e.id = ja.employee_id
      WHERE ja.job_id = job_inventory.job_id
        AND e.employee_user_id = auth.uid()
    )
  )
  WITH CHECK (
    job_id IN (
      SELECT jobs.id FROM jobs
      WHERE jobs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN employees e ON e.id = ja.employee_id
      WHERE ja.job_id = job_inventory.job_id
        AND e.employee_user_id = auth.uid()
    )
  );

-- DELETE: same scoping
CREATE POLICY "auth_delete_job_inventory" ON job_inventory
  FOR DELETE TO authenticated
  USING (
    job_id IN (
      SELECT jobs.id FROM jobs
      WHERE jobs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN employees e ON e.id = ja.employee_id
      WHERE ja.job_id = job_inventory.job_id
        AND e.employee_user_id = auth.uid()
    )
  );

-- 5. Fix job-photos storage bucket listing
--    The bucket is public so photo URLs work without signed tokens.
--    The broad SELECT policy on storage.objects allowed listing ALL files.
--    Replace with folder-scoped policies.

DROP POLICY IF EXISTS auth_read_job_photos ON storage.objects;

-- Owners: read any object in their own folder
CREATE POLICY "auth_read_own_job_photos" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Employees: read objects in their employer's folder
CREATE POLICY "auth_read_employer_job_photos" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT e.user_id::text FROM employees e
      WHERE e.employee_user_id = auth.uid()
    )
  );
