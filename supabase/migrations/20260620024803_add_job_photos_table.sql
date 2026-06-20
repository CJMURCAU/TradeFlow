
-- Create job_photos table
CREATE TABLE IF NOT EXISTS job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  uploaded_by_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;

-- Owners: full access to all photos on their jobs
CREATE POLICY "owner_select_job_photos" ON job_photos FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "owner_insert_job_photos" ON job_photos FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner_delete_job_photos" ON job_photos FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Employees: select photos on jobs they are assigned to
CREATE POLICY "employee_select_job_photos" ON job_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN employees e ON e.id = ja.employee_id
      WHERE ja.job_id = job_photos.job_id
        AND e.employee_user_id = auth.uid()
    )
  );

-- Employees: insert their own photos
CREATE POLICY "employee_insert_job_photos" ON job_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by_employee_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = uploaded_by_employee_id
        AND e.employee_user_id = auth.uid()
    )
  );

-- Employees: delete only their own uploads
CREATE POLICY "employee_delete_job_photos" ON job_photos FOR DELETE
  TO authenticated
  USING (
    uploaded_by_employee_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = uploaded_by_employee_id
        AND e.employee_user_id = auth.uid()
    )
  );

-- Enforce max 6 photos per job via trigger
CREATE OR REPLACE FUNCTION check_job_photo_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM job_photos WHERE job_id = NEW.job_id) >= 6 THEN
    RAISE EXCEPTION 'Maximum of 6 photos per job reached';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_job_photo_limit
  BEFORE INSERT ON job_photos
  FOR EACH ROW EXECUTE FUNCTION check_job_photo_limit();

-- Index for fast lookups by job
CREATE INDEX IF NOT EXISTS idx_job_photos_job_id ON job_photos(job_id);
