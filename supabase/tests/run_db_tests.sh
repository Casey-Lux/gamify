#!/usr/bin/env bash
# =============================================================================
# supabase/tests/run_db_tests.sh
# Fase 12 — spec sección 44 "Database tests"
#
# Builds a disposable PostgreSQL database, applies _harness.sql (stand-in
# auth/storage schemas + roles, spec section 44 requires testing against
# real RLS/RPC behavior, not mocks) then every migration in order, then
# every *_test.sql file in this directory, then the shell-based concurrency
# tests. Exits non-zero if anything failed.
#
# Requires a PostgreSQL server reachable as a superuser (default: the local
# `postgres` OS/db user via the Unix socket — exactly how this was verified
# in the development sandbox). Override via PGHOST/PGPORT/PGUSER/PGDATABASE
# env vars to point at a different server (e.g. a CI service container).
#
# Usage:
#   supabase/tests/run_db_tests.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"
TEST_DB="${TEST_DB:-gamify_test}"
PSQL="psql -v ON_ERROR_STOP=1 -X -q"

echo "== Fase 12: database tests =="
echo "Rebuilding database '$TEST_DB'..."
$PSQL -d postgres -c "drop database if exists $TEST_DB;"
$PSQL -d postgres -c "create database $TEST_DB;"

echo "Applying harness (auth/storage stand-ins + roles)..."
$PSQL -d "$TEST_DB" -f "$SCRIPT_DIR/_harness.sql"

echo "Applying migrations..."
for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "  -> $(basename "$f")"
  $PSQL -d "$TEST_DB" -f "$f"
done

failures=0
run_test() {
  local file="$1"
  echo ""
  echo "-- $(basename "$file")"
  if $PSQL -d "$TEST_DB" -f "$file"; then
    echo "   OK"
  else
    echo "   FAILED"
    failures=$((failures + 1))
  fi
}

for f in "$SCRIPT_DIR"/*_test.sql; do
  run_test "$f"
done

echo ""
echo "-- concurrency_test.sh"
if TEST_DB="$TEST_DB" "$SCRIPT_DIR/concurrency_test.sh"; then
  echo "   OK"
else
  echo "   FAILED"
  failures=$((failures + 1))
fi

echo ""
if [ "$failures" -eq 0 ]; then
  echo "All database tests passed."
else
  echo "$failures test file(s) failed."
  exit 1
fi
