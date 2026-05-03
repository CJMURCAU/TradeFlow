/*
  # Allow employees to update job status on assigned jobs

  ## Problem
  When an employee starts the timer, startTimer() also sets the job status to 'active'.
  Employees had no UPDATE policy on the jobs table, causing a silent RLS failure.

  ## Changes
  - UPDATE: employees can update the status column on jobs they are assigned to
*/

CREATE POLICY "Employees can update status on assigned jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN employees e ON e.id = ja.employee_id
      WHERE ja.job_id = jobs.id
        AND e.employee_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN employees e ON e.id = ja.employee_id
      WHERE ja.job_id = jobs.id
        AND e.employee_user_id = auth.uid()
    )
  );
