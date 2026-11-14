#!/bin/bash
# Replaces staging's data with production's catalog. Leaves staging stopped;
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

# Only these tables' rows are copied; every other table arrives empty. Staging
# is open to the internet, so customers' data stays out, including tables
# added later.
COPIED_TABLES="'_prisma_migrations', 'AppVersion', 'Brand', 'Category', 'Color',
  '_ColorToProduct', 'DollarRate', 'Prices', 'Product', 'PromoBanner',
  'PushRetryConfig'"

OTHER_TABLES=$(psql "$PROD_URL" -v ON_ERROR_STOP=1 -At -c "
  SELECT format('public.%I', tablename) FROM pg_tables
  WHERE schemaname = 'public' AND tablename NOT IN ($COPIED_TABLES)")

EXCLUDE_ARGS=()
for table in $OTHER_TABLES; do
  EXCLUDE_ARGS+=("--exclude-table-data=$table")
done

DUMP=$(mktemp /tmp/prod-data-XXXXXX.dump)
trap 'rm -f "$DUMP"' EXIT

# Dump before touching staging, so a failed dump leaves staging as it was.
pg_dump --format=custom --no-owner --no-privileges "${EXCLUDE_ARGS[@]}" \
  --file="$DUMP" "$PROD_URL"

"$(dirname "$0")/stop-server.sh"

psql "$STAGING_URL" -v ON_ERROR_STOP=1 -q \
  -c 'SET client_min_messages = warning; DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$STAGING_URL" "$DUMP"

psql "$STAGING_URL" -c 'SELECT count(*) AS products, max("createdAt") AS newest,
  (SELECT count(*) FROM "User") AS users FROM "Product";'
