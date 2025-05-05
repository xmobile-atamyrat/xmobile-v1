#!/bin/bash

arg=$1

source .env.local

if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL is not set in the environment."
    exit 1
fi

DATABASE_URL=${DATABASE_URL%\?schema=public}
CURRENT_DIR=$(pwd)

apply_db() {
    docker stop db
    docker rm db
    docker volume rm xmobile-v1_db
    docker-compose up -d

    sleep 1

    psql "postgresql://postgres:password@localhost:5433" <<EOF
        create user xmobile with password 'password';
        alter user xmobile superuser;
EOF
    docker cp backup/db_backup.sql db:/db_backup.sql
    docker exec -it db bash -c "PGPASSWORD='password' pg_restore -U xmobile -d postgres /db_backup.sql"
}


apply_images() {
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
}

if [  "$arg" == "db" ]; then
    apply_db
elif [  "$arg" == "images" ]; then
    apply_images
elif [  "$arg" == "all" ]; then
    apply_db
    apply_images
else
    echo "Provide an arg. Options: db, images, all"
fi