#!/bin/bash

# Load environment variables from .env.local if present
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not found in .env.local"
  exit 1
fi

# Clean the URL (remove query parameters like ?schema=public which psql might reject)
CLEAN_URL="${DATABASE_URL%%\?*}"

echo "Executing backfill_prices.sql against database..."
psql "$CLEAN_URL" -f scripts/backfill_prices.sql

echo "Done."
