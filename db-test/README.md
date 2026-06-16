# Migration test harness

Validates that the Supabase migration chain in `supabase/migrations/` applies
cleanly **from scratch, in order** — catching the class of bug the audit found
(a policy/function referencing a column that no migration creates, or migrations
that only work because something was changed by hand in the dashboard).

It runs against a throwaway plain-Postgres container plus a small
[`shim.sql`](shim.sql) that stands in for the Supabase-provided bits
(`anon`/`authenticated`/`service_role` roles, the `auth` schema + `auth.uid()`,
and `vault`). The shim is for testing only and is never applied to a real DB.

## Run it locally

```bash
docker compose -f db-test/docker-compose.yml up -d
./db-test/run.sh
docker compose -f db-test/docker-compose.yml down -v
```

A clean run ends with:

```
✅ All migrations applied cleanly — schema is reproducible from scratch.
```

## CI

`.github/workflows/ci.yml` runs the same `run.sh` against a Postgres service
container on every push / PR, alongside the TypeScript type-check.
