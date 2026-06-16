/*
  # Race-free, unique per-owner job card numbers   [audit D-C2 / S-M1]

  Problem: the app read next_job_card_number() then inserted separately — two
  concurrent creates could read the same MAX and insert the same number, with
  no uniqueness to stop them. The numbering function was also SECURITY DEFINER
  without SET search_path (S-M1).

  Fix:
  - next_job_card_number() now sets search_path and takes a per-owner advisory
    lock so concurrent callers serialise.
  - A BEFORE INSERT trigger assigns the number atomically when the app doesn't
    supply one (the app is updated to stop supplying it).
  - A UNIQUE(user_id, job_card_number) constraint guarantees no duplicates.
*/

-- Remove the legacy global serial default (audit D-L2). While it remains, every
-- insert pre-fills job_card_number via nextval() (1000, 1001, ...), which means
-- NEW.job_card_number is never NULL and the per-owner trigger below is bypassed.
ALTER TABLE jobs ALTER COLUMN job_card_number DROP DEFAULT;
DROP SEQUENCE IF EXISTS jobs_job_card_number_seq;

CREATE OR REPLACE FUNCTION next_job_card_number(owner_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_num integer;
  max_existing integer;
BEGIN
  -- Serialise number assignment per owner within the transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended(owner_user_id::text, 0));

  SELECT COALESCE(job_card_number_start, 1000)
  INTO start_num
  FROM business_details
  WHERE user_id = owner_user_id;

  IF start_num IS NULL THEN
    start_num := 1000;
  END IF;

  SELECT COALESCE(MAX(job_card_number), 0)
  INTO max_existing
  FROM jobs
  WHERE user_id = owner_user_id;

  RETURN GREATEST(start_num, max_existing + 1);
END;
$$;

GRANT EXECUTE ON FUNCTION next_job_card_number(uuid) TO authenticated;

-- Assign the number at insert time when the app doesn't provide one.
CREATE OR REPLACE FUNCTION assign_job_card_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW; -- can't number without an owner
  END IF;
  IF NEW.job_card_number IS NOT NULL AND NEW.job_card_number > 0 THEN
    RETURN NEW; -- explicit number supplied; uniqueness constraint guards dupes
  END IF;
  NEW.job_card_number := next_job_card_number(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_job_card_number ON jobs;
CREATE TRIGGER trg_assign_job_card_number
  BEFORE INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION assign_job_card_number();

-- Uniqueness per owner (added only when current data allows it).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_user_job_card_number_key') THEN
    IF NOT EXISTS (
      SELECT 1 FROM jobs
      WHERE user_id IS NOT NULL
      GROUP BY user_id, job_card_number
      HAVING count(*) > 1
    ) THEN
      ALTER TABLE jobs ADD CONSTRAINT jobs_user_job_card_number_key UNIQUE (user_id, job_card_number);
    ELSE
      RAISE NOTICE 'duplicate (user_id, job_card_number) rows exist; resolve then add the unique constraint';
    END IF;
  END IF;
END $$;
