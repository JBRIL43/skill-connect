#!/usr/bin/env bash
# psql against the live project, for the non-Windows half of the team.
# scripts/run-sql.ps1 is the PowerShell equivalent.
#
#   ./scripts/db.sh                                  # interactive shell
#   ./scripts/db.sh -c "select count(*) from profiles;"
#   ./scripts/db.sh -f scripts/normalize-seed-vocabulary.sql
#
# Goes through the pooler rather than db.<ref>.supabase.co, because the direct
# host is IPv6-only and most connections here cannot reach it. Session mode
# (5432) rather than transaction mode (6543), since migrations need it.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "no .env.local — copy .env.example and fill in the Supabase keys" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env.local
set +a

: "${SUPABASE_PROJECT_REF:?set SUPABASE_PROJECT_REF in .env.local}"
: "${SUPABASE_DB_PASSWORD:?set SUPABASE_DB_PASSWORD in .env.local}"

# Override if the project is not in eu-central-1.
REGION="${SUPABASE_REGION:-eu-central-1}"

export PGPASSWORD="$SUPABASE_DB_PASSWORD"
exec psql \
  "postgresql://postgres.${SUPABASE_PROJECT_REF}@aws-0-${REGION}.pooler.supabase.com:5432/postgres" \
  -v ON_ERROR_STOP=1 "$@"
