/*
  # Allow employees to manage time entries on assigned jobs

  ## Problem
  Employees could not start/stop the timer because they had no INSERT or UPDATE
  policy on the time_entries table.

  ## Changes
  - INSERT: employees can add time entries for jobs they are assigned to
  - UPDATE: employees can update (stop) time entries on jobs they are assigned to
*/

CREATE POLICY "Employees can insert time entries on assigned jobs"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN employees e ON e.id = ja.employee_id
      WHERE ja.job_id = time_entries.job_id
        AND e.employee_user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can update time entries on assigned jobs"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN employees e ON e.id = ja.employee_id
      WHERE ja.job_id = time_entries.job_id
        AND e.employee_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN employees e ON e.id = ja.employee_id
      WHERE ja.job_id = time_entries.job_id
        AND e.employee_user_id = auth.uid()
    )
  );
