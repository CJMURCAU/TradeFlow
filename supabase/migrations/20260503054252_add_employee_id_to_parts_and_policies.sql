/*
  # Add employee_id to parts and employee insert/delete policies

  1. Changes
    - parts: add nullable employee_id (FK to employees)
  2. Security
    - Employees can insert parts on jobs they are assigned to
    - Employees can delete their own parts
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parts' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE parts ADD COLUMN employee_id uuid REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE POLICY "Employees can insert parts on assigned jobs"
  ON parts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN employees e ON e.id = ja.employee_id
      WHERE ja.job_id = parts.job_id
        AND e.employee_user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can delete own parts"
  ON parts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = parts.employee_id
        AND e.employee_user_id = auth.uid()
    )
  );
