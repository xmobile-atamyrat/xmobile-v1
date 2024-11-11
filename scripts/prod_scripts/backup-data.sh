#!/bin/bash

tar -czvf /home/ubuntu/tar-file/images.tar.gz /home/ubuntu/images
PGPASSWORD=REDACTED_ADMIN_PASSWORD pg_dump -U xmobile -F c -b -v -f /home/ubuntu/db_backup/db_backup.sql postgres
