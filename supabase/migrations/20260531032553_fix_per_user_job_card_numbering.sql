/*
  # Fix per-user job card numbering

  ## Problem
  The previous implementation used a single global PostgreSQL sequence
  (jobs_job_card_number_seq) shared across ALL users. This meant:
  1. When any user set a starting number, the sequence reset affected all users.
  2. The renumber_jobs_from function counted ALL jobs in the table (not just the
     user's own jobs) when calculating the next sequence value.
  3. If business_details didn't exist yet when the start number was first saved,
     renumbering was skipped entirely.

  ## Solution
  Replace the global sequence approach with a per-user function
  `next_job_card_number(owner_user_id uuid)` that:
  - Looks up that user's job_card_number_start from business_details (default 1000)
  - Finds the MAX job_card_number already assigned to that user's jobs
  - Returns whichever is higher + 1, ensuring numbers never go backwards
  - Employees pass their employer's user_id so they share the same numbering

  ## Changes
  - Drops the old `renumber_jobs_from` function (no longer needed)
  - Creates new `next_job_card_number(owner_user_id uuid)` SECURITY DEFINER function
  - The jobs table job_card_number column is kept as-is (integer, no sequence dependency)
    but new inserts will call this function explicitly from the app layer

  ## Notes
  - Existing job numbers are preserved — the function just ensures future numbers
    are higher than any existing ones for that user.
  - The serial/sequence still exists on the column but is no longer used for inserts;
    the app now passes the calculated number explicitly.
*/

-- Drop old global renumber function
DROP FUNCTION IF EXISTS renumber_jobs_from(integer);

-- New per-user next number function
CREATE OR REPLACE FUNCTION next_job_card_number(owner_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_num integer;
  max_existing integer;
BEGIN
  -- Get the user's preferred starting number (default 1000)
  SELECT COALESCE(job_card_number_start, 1000)
  INTO start_num
  FROM business_details
  WHERE user_id = owner_user_id;

  -- Default to 1000 if no business_details row yet
  IF start_num IS NULL THEN
    start_num := 1000;
  END IF;

  -- Find the highest number already used by this owner
  SELECT COALESCE(MAX(job_card_number), 0)
  INTO max_existing
  FROM jobs
  WHERE user_id = owner_user_id;

  -- Return whichever is greater, +1
  RETURN GREATEST(start_num, max_existing + 1);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION next_job_card_number(uuid) TO authenticated;
