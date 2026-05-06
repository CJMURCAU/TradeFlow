/*
  # Add per-employee hourly rate and link time entries to employees

  ## Changes

  1. employees table
     - Add `hourly_rate` (numeric, nullable) — the owner-set rate for this employee.
       NULL means fall back to business_details.default_hourly_rate.

  2. time_entries table
     - Add `employee_id` (uuid, nullable FK → employees.id) — records which employee
       started the timer so labour cost can be calculated per-employee rate.

  ## Notes
  - Both columns are nullable; existing rows are unaffected.
  - No RLS changes needed: time_entries and employees already have appropriate policies.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'hourly_rate'
  ) THEN
    ALTER TABLE employees ADD COLUMN hourly_rate numeric(10,2) DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN employee_id uuid DEFAULT NULL REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;
