/*
  # Fix jobs RLS policy for employees with full calendar access

  ## Problem
  The existing "Employees can view assigned jobs" policy only lets employees
  SELECT jobs they are assigned to. When an employer toggles calendar_access ON
  for an employee, the app code tries to fetch all jobs but the database blocks
  it because the RLS policy doesn't account for the calendar_access flag.

  ## Changes
  - Drop the old restrictive SELECT policy for employees on the jobs table
  - Add a new policy that allows employees to SELECT:
      a) Jobs assigned to them (existing behaviour, calendar_access = false)
      b) All jobs owned by their employer when calendar_access = true
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Employees can view assigned jobs" ON jobs;

-- New policy: assigned jobs OR all employer jobs when calendar_access is on
CREATE POLICY "Employees can view jobs based on access level"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    -- Job is directly assigned to this employee
    id IN (
      SELECT ja.job_id
      FROM job_assignments ja
      JOIN employees e ON e.id = ja.employee_id
      WHERE e.employee_user_id = auth.uid()
    )
    OR
    -- Employee has full calendar access and this job belongs to their employer
    EXISTS (
      SELECT 1
      FROM employees e
      WHERE e.employee_user_id = auth.uid()
        AND e.calendar_access = true
        AND e.user_id = jobs.user_id
    )
  );
