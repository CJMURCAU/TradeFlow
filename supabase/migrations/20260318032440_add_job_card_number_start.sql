/*
  # Add job card number start to business_details

  ## Changes
  - `business_details`: adds `job_card_number_start` (integer, default 1000)
    - Stores the user-chosen starting number for job card numbering
  - Adds a helper function `renumber_jobs_from(start integer)` that reassigns
    `job_card_number` to all existing jobs (ordered by created_at) beginning at `start`,
    and then restarts the sequence so future jobs continue from the correct next value.

  ## Notes
  - Existing installs default to 1000 (matching the original sequence start).
  - The function is called from the app whenever the user saves a new start value.
  - The sequence is also reset so newly inserted jobs get the correct next number.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_details' AND column_name = 'job_card_number_start'
  ) THEN
    ALTER TABLE business_details ADD COLUMN job_card_number_start integer DEFAULT 1000 NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION renumber_jobs_from(start_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_count integer;
BEGIN
  SELECT COUNT(*) INTO job_count FROM jobs;

  UPDATE jobs j
  SET job_card_number = sub.new_number
  FROM (
    SELECT id, (start_number - 1 + ROW_NUMBER() OVER (ORDER BY created_at ASC)) AS new_number
    FROM jobs
  ) sub
  WHERE j.id = sub.id;

  PERFORM setval('jobs_job_card_number_seq', COALESCE(start_number + job_count, start_number), false);
END;
$$;
