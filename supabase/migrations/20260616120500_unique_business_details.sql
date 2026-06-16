/*
  # One business_details row per owner   [audit D-H3]

  business_details was retrofitted to one-row-per-owner but had no UNIQUE(user_id),
  so a user could accumulate several rows — making next_job_card_number() and the
  settings upsert non-deterministic. Add the constraint (and NOT NULL now that the
  legacy seed row with a NULL user_id has been removed by 20260506042954).
*/

-- The base schema seeds one blank business_details row with a NULL user_id.
-- An earlier migration removed it by hard-coded id (prod only), so on a fresh
-- database it survives. Remove any unowned row generically so the constraints
-- below can apply everywhere.
DELETE FROM business_details WHERE user_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_details_user_id_key') THEN
    IF NOT EXISTS (SELECT 1 FROM business_details WHERE user_id IS NULL)
       AND NOT EXISTS (
         SELECT 1 FROM business_details
         WHERE user_id IS NOT NULL
         GROUP BY user_id
         HAVING count(*) > 1
       ) THEN
      ALTER TABLE business_details ALTER COLUMN user_id SET NOT NULL;
      ALTER TABLE business_details ADD CONSTRAINT business_details_user_id_key UNIQUE (user_id);
    ELSE
      RAISE NOTICE 'business_details has NULL or duplicate user_id rows; resolve then add the constraint';
    END IF;
  END IF;
END $$;
