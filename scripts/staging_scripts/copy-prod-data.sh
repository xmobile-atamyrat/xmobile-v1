#!/bin/bash
# Replaces staging's data with a copy of production's. Leaves staging stopped;
# restart-server.sh starts it again.
set -euo pipefail

read_db_url() {
  grep -E '^DATABASE_URL=' "$1" | cut -d= -f2- | tr -d '"' | sed 's/?.*//'
}

PROD_URL=$(read_db_url /home/ubuntu/xmobile-v1/.env)
STAGING_URL=$(read_db_url /home/ubuntu/xmobile-staging/.env)

# Both databases live on one server under one login, so a wrong target here
# would overwrite production.
if [ "${STAGING_URL##*/}" != 'staging' ] || [ "$PROD_URL" = "$STAGING_URL" ]; then
  echo "Refusing to copy: the target database is not 'staging'." >&2
  exit 1
fi

DUMP=$(mktemp /tmp/prod-data-XXXXXX.dump)
trap 'rm -f "$DUMP"' EXIT

# Dump before touching staging, so a failed dump leaves staging as it was.
pg_dump --format=custom --no-owner --no-privileges --file="$DUMP" "$PROD_URL"

"$(dirname "$0")/stop-server.sh"

psql "$STAGING_URL" -v ON_ERROR_STOP=1 -q \
  -c 'SET client_min_messages = warning; DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$STAGING_URL" "$DUMP"

# Staging uses production's Firebase project, so these tokens would push to
# real customers' phones.
psql "$STAGING_URL" -v ON_ERROR_STOP=1 -q -c 'DELETE FROM "FCMToken";'

psql "$STAGING_URL" -c 'SELECT count(*) AS products, max("createdAt") AS newest FROM "Product";'
