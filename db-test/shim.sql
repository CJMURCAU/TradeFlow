-- Supabase-compatibility shim for testing migrations on vanilla Postgres.
--
-- The migrations target a Supabase database, which provides roles
-- (anon/authenticated/service_role), an `auth` schema with auth.uid()/etc.,
-- and a `vault` schema. Plain Postgres has none of these, so we create
-- minimal stand-ins here. This lets CI / a local container verify that the
-- whole migration chain applies cleanly and in the right order.
--
-- This file is for TESTING ONLY. It is never applied to a real database.

-- Roles the migrations GRANT to / create policies for.
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS vault;

-- Minimal auth.users so FKs (REFERENCES auth.users(id)) resolve.
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  created_at timestamptz DEFAULT now()
);

-- auth helpers used by RLS policies / SECURITY DEFINER functions.
-- They only need to EXIST for migrations to apply; values come from a JWT at
-- runtime on real Supabase. Here they read GUCs and default to NULL.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

-- vault.create_secret stub (the only vault call is now a no-op, but keep this
-- so older revisions of the chain still apply).
CREATE OR REPLACE FUNCTION vault.create_secret(
  secret text, name text DEFAULT NULL, description text DEFAULT ''
) RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid(); $$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA vault TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO anon, authenticated, service_role;
