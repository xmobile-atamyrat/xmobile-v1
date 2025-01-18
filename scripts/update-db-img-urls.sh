#!/bin/bash

source .env.local

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set in the environment."
  exit 1
fi

DATABASE_URL=${DATABASE_URL%\?schema=public}
CURRENT_DIR=$(pwd)

psql "$DATABASE_URL" <<EOF
UPDATE "Category"
SET "imgUrl" = '$CURRENT_DIR/backup' || "imgUrl";

UPDATE "Product"
SET "imgUrls" = (
  SELECT array_agg('$CURRENT_DIR/backup' || url)
  FROM unnest("imgUrls") AS url
);
EOF

echo "imgUrl column in Category table and imgUrls column in Product table have been updated."