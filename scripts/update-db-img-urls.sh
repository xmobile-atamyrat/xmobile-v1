#!/bin/bash

CURRENT_DIR=$(dirname "$(realpath "$0")")

# convert to windows-style path if on windows
if [[ "$OSTYPE" == "cygwin" || "$OSTYPE" == "msys" ]]; then
  CURRENT_DIR=$(cygpath -w "$CURRENT_DIR")
fi
source "$CURRENT_DIR/../.env.local"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set in the environment."
  exit 1
fi

DATABASE_URL=${DATABASE_URL%\?schema=public}

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