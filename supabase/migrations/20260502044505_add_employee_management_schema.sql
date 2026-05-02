/*
  # Employee Management Schema

  ## Summary
  Adds multi-user collaboration support for the TradeFlow app. Business owners can invite employees,
  assign jobs to them, and receive notifications when employees complete work.

  ## New Tables

  ### user_roles
  - Links auth user IDs to their role: 'owner' or 'employee'
  - `user_id` - references auth.users
  - `role` - 'owner' or 'employee'
  - `owner_id` - for employees, references the owner's user_id

  ### employees
  - Stores employee records created by the business owner
  - `user_id` (owner) - the business owner who created this record
  - `employee_user_id` - the auth user ID once the employee accepts invite (nullable)
  - `name` - employee display name
  - `email` - invite email address
  - `status` - 'pending' (invited, not yet signed up) or 'active'
  - `calendar_access` - whether this employee can see all jobs or only assigned ones
  - `invite_token` - unique token used to link employee signup to this record

  ### job_assignments
  - Links employees to specific jobs
  - `job_id` - references jobs
  - `employee_id` - references employees
  - `assigned_by` - the owner user_id who made the assignment
  - `completed` - whether the employee has marked their assignment done

  ### job_employee_notes
  - Notes submitted by employees on specific jobs
  - `job_id` - references jobs
  - `employee_id` - references employees
  - `note` - the text note

  ### employee_notifications
  - In-app notifications for the business owner
  - `recipient_user_id` - the owner who receives the notification
  - `message` - notification text
  - `job_id` - related job (nullable)
  - `read` - whether the owner has read it

  ## Security
  - RLS enabled on all new tables
  - Owners can fully manage their own employees and see all related data
  - Employees can only see their own assignments and post their own notes
*/

-- user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'employee')),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own role"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own role"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owners need to read roles of their employees to validate assignments
CREATE POLICY "Owners can read employee roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  calendar_access boolean NOT NULL DEFAULT false,
  invite_token text UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their employees"
  ON employees FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can update their employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can delete their employees"
  ON employees FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Employees can view their own employee record
CREATE POLICY "Employees can view own record"
  ON employees FOR SELECT
  TO authenticated
  USING (employee_user_id = auth.uid());

-- Employees can update their own record (e.g., to link their user ID on signup)
CREATE POLICY "Employees can update own record"
  ON employees FOR UPDATE
  TO authenticated
  USING (employee_user_id = auth.uid())
  WITH CHECK (employee_user_id = auth.uid());

-- Allow unauthenticated to read by invite_token (for the invite linking flow)
CREATE POLICY "Allow invite token lookup"
  ON employees FOR SELECT
  TO anon
  USING (invite_token IS NOT NULL);

-- job_assignments table
CREATE TABLE IF NOT EXISTS job_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(job_id, employee_id)
);

ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view assignments on their jobs"
  ON job_assignments FOR SELECT
  TO authenticated
  USING (assigned_by = auth.uid());

CREATE POLICY "Owners can insert assignments"
  ON job_assignments FOR INSERT
  TO authenticated
  WITH CHECK (assigned_by = auth.uid());

CREATE POLICY "Owners can update assignments"
  ON job_assignments FOR UPDATE
  TO authenticated
  USING (assigned_by = auth.uid())
  WITH CHECK (assigned_by = auth.uid());

CREATE POLICY "Owners can delete assignments"
  ON job_assignments FOR DELETE
  TO authenticated
  USING (assigned_by = auth.uid());

-- Employees can view and update their own assignments
CREATE POLICY "Employees can view own assignments"
  ON job_assignments FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE employee_user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can update own assignments"
  ON job_assignments FOR UPDATE
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE employee_user_id = auth.uid()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE employee_user_id = auth.uid()
    )
  );

-- job_employee_notes table
CREATE TABLE IF NOT EXISTS job_employee_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE job_employee_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view notes on their jobs"
  ON job_employee_notes FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can view own notes"
  ON job_employee_notes FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE employee_user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can insert own notes"
  ON job_employee_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE employee_user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can update own notes"
  ON job_employee_notes FOR UPDATE
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE employee_user_id = auth.uid()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE employee_user_id = auth.uid()
    )
  );

-- employee_notifications table
CREATE TABLE IF NOT EXISTS employee_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE employee_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients can view own notifications"
  ON employee_notifications FOR SELECT
  TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY "Recipients can update own notifications"
  ON employee_notifications FOR UPDATE
  TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

-- Employees can insert notifications for their owner
CREATE POLICY "Employees can insert notifications for owner"
  ON employee_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    recipient_user_id IN (
      SELECT e.user_id FROM employees e WHERE e.employee_user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_employee_user_id ON employees(employee_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_invite_token ON employees(invite_token);
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_employee_id ON job_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_job_employee_notes_job_id ON job_employee_notes(job_id);
CREATE INDEX IF NOT EXISTS idx_employee_notifications_recipient ON employee_notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
