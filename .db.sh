#!/usr/bin/env bash
# Local helper: opens a psql connection to the live project through the IPv4
# pooler. Sourced by the live-verification scripts. Not committed.
set -a
. ./.env.local
set +a

export PGPASSWORD="$SUPABASE_DB_PASSWORD"
export PGHOST="aws-0-eu-central-1.pooler.supabase.com"
export PGPORT="5432"
export PGUSER="postgres.${SUPABASE_PROJECT_REF}"
export PGDATABASE="postgres"
export DBURL="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"

db() { psql "$DBURL" -v ON_ERROR_STOP=1 "$@"; }
dbq() { psql "$DBURL" -tAq -v ON_ERROR_STOP=1 "$@"; }
