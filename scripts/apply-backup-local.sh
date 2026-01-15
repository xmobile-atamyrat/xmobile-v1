#!/bin/bash

arg=$1

source .env.local

if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL is not set in the environment."
    exit 1
fi

# Extract connection details from DATABASE_URL
# Format: postgresql://xmobile:password@localhost:5432/postgres?schema=public
DATABASE_URL_CLEAN=${DATABASE_URL%\?schema=public}
CURRENT_DIR=$(pwd)

apply_db() {
    echo "Applying database backup to local PostgreSQL server..."
    
    # Check if backup file exists
    if [ ! -f "backup/db_backup.sql" ]; then
        echo "Error: backup/db_backup.sql not found"
        exit 1
    fi
    
    # Terminate any existing connections to the database
    echo "Terminating existing connections..."
    psql "postgresql://xmobile:password@localhost:5432/template1" <<EOF
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = 'postgres' AND pid <> pg_backend_pid();
EOF
    
    # Drop and recreate the database to ensure clean state
    # Connect to template1 database to drop the target database
    echo "Dropping and recreating database..."
    psql "postgresql://xmobile:password@localhost:5432/template1" <<EOF
        DROP DATABASE IF EXISTS postgres;
        CREATE DATABASE postgres;
EOF
    
    # Restore the database backup
    echo "Restoring database from backup..."
    
    # Try to use the newest available pg_restore for compatibility with newer backups
    # PostgreSQL 17 can read backups from PostgreSQL 16
    PG_RESTORE_CMD="pg_restore"
    PG17_RESTORE=$(find /opt/homebrew/Cellar/libpq -name "pg_restore" -type f 2>/dev/null | head -1)
    if [ -n "$PG17_RESTORE" ] && [ -x "$PG17_RESTORE" ]; then
        PG_RESTORE_CMD="$PG17_RESTORE"
        echo "Using PostgreSQL 17's pg_restore for better compatibility..."
    elif command -v /opt/homebrew/opt/postgresql@15/bin/pg_restore &> /dev/null; then
        PG_RESTORE_CMD="/opt/homebrew/opt/postgresql@15/bin/pg_restore"
        echo "Using PostgreSQL 15's pg_restore..."
    fi
    
    PGPASSWORD=password $PG_RESTORE_CMD -U xmobile -d postgres -h localhost -p 5432 --no-owner --no-acl --verbose backup/db_backup.sql 2>&1
    RESTORE_EXIT_CODE=$?
    
    # Check if restore actually succeeded by verifying tables exist
    # pg_restore may exit with code 1 for warnings (like transaction_timeout in PG16 backups)
    TABLE_COUNT=$(psql "$DATABASE_URL_CLEAN" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>/dev/null | tr -d ' ')
    
    if [ -z "$TABLE_COUNT" ] || [ "$TABLE_COUNT" -eq 0 ]; then
        echo "Error: Database restore failed - no tables found in database"
        echo "pg_restore exited with code $RESTORE_EXIT_CODE"
        echo "This might be due to version incompatibility. The backup was created with PostgreSQL 16.11."
        echo "If you see 'unsupported version' errors, you may need to install PostgreSQL 16 or recreate the backup with a compatible version."
        exit 1
    elif [ $RESTORE_EXIT_CODE -ne 0 ]; then
        echo "Warning: pg_restore exited with code $RESTORE_EXIT_CODE, but $TABLE_COUNT tables were restored successfully"
        echo "This is likely due to minor compatibility warnings (e.g., transaction_timeout) which can be ignored."
    else
        echo "Database restored successfully with $TABLE_COUNT tables"
    fi
    
    # Update image URLs in the database
    echo "Updating image URLs in database..."
    psql "$DATABASE_URL_CLEAN" <<EOF
        UPDATE "Category"
        SET "imgUrl" = '$CURRENT_DIR/backup' || "imgUrl";

        UPDATE "Product"
        SET "imgUrls" = (
        SELECT array_agg('$CURRENT_DIR/backup' || url)
        FROM unnest("imgUrls") AS url
        );
EOF
    echo "imgUrl column in Category table and imgUrls column in Product table have been updated."
    echo "Database backup applied successfully!"
}

apply_images() {
    echo "Extracting images..."
    if [ ! -f "backup/images.tar.gz" ]; then
        echo "Error: backup/images.tar.gz not found"
        exit 1
    fi
    tar -xzvf backup/images.tar.gz -C backup
    echo "Images extracted successfully!"
}

if [ "$arg" == "db" ]; then
    apply_db
elif [ "$arg" == "images" ]; then
    apply_images
elif [ "$arg" == "all" ]; then
    apply_db
    apply_images
else
    echo "Provide an arg. Options: db, images, all"
    exit 1
fi
