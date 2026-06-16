#!/usr/bin/env bash
# Apply the Supabase shim + every migration (in filename order) to a Postgres,
# stopping on the first error. Verifies the migration chain is reproducible
# from scratch — the exact thing a fresh `supabase db reset` would do.
#
# Local use (with db-test/docker-compose.yml running):
#   ./db-test/run.sh
# CI / custom target: override PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE.
set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-54329}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
export PGPASSWORD

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PSQL=(psql -v ON_ERROR_STOP=1 -X -q -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE")

echo "==> Resetting public schema"
"${PSQL[@]}" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" >/dev/null

echo "==> Applying Supabase compatibility shim"
"${PSQL[@]}" -f "$ROOT/db-test/shim.sql" >/dev/null

echo "==> Applying migrations in order"
shopt -s nullglob
for f in "$ROOT"/supabase/migrations/*.sql; do
  printf '   - %s\n' "$(basename "$f")"
  "${PSQL[@]}" -f "$f" >/dev/null
done

echo ""
echo "✅ All migrations applied cleanly — schema is reproducible from scratch."
