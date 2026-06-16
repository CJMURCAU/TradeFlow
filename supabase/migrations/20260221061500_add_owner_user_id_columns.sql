/*
  # Add owner (user_id) columns to clients, jobs, business_details   [audit D-C1 / S-H1]

  ## Problem
  Every later migration's RLS — and the whole multi-tenant model — depends on
  `clients.user_id`, `jobs.user_id` and `business_details.user_id`. Those
  columns were only ever added by hand in the Supabase dashboard, never in a
  migration, so the schema is not reproducible: a fresh `supabase db reset`
  fails at 20260502044505 with `column "user_id" does not exist`.

  ## Fix
  Create the columns here, early in the chain (right after the base schema and
  before anything references them). Everything is guarded so this is also a
  safe no-op on the existing production database where the columns already
  exist:
    - ADD COLUMN IF NOT EXISTS
    - FK to auth.users(id) ON DELETE CASCADE, added only if absent (also fixes
      audit D-H1: deleting an owner now cascades their core data)
    - SET NOT NULL only when the column currently has no NULLs (so it tightens
      fresh/clean databases without failing where legacy NULL rows still exist)

  Per-column indexes are added in a later migration (audit D-H4).
*/

ALTER TABLE clients          ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE jobs             ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE business_details ADD COLUMN IF NOT EXISTS user_id uuid;

-- Foreign keys to auth.users with cascade delete (guarded against re-runs).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_user_id_fkey') THEN
    ALTER TABLE clients ADD CONSTRAINT clients_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_user_id_fkey') THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_details_user_id_fkey') THEN
    ALTER TABLE business_details ADD CONSTRAINT business_details_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enforce NOT NULL where the data already allows it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM clients WHERE user_id IS NULL) THEN
    ALTER TABLE clients ALTER COLUMN user_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'clients.user_id has NULLs; left nullable. Backfill then SET NOT NULL.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM jobs WHERE user_id IS NULL) THEN
    ALTER TABLE jobs ALTER COLUMN user_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'jobs.user_id has NULLs; left nullable. Backfill then SET NOT NULL.';
  END IF;

  -- business_details intentionally not forced NOT NULL here: the base schema
  -- seeds one blank row with a NULL user_id which a later migration removes
  -- (20260506042954). Forcing NOT NULL is handled in the uniqueness migration.
END $$;
