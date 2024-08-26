#!/bin/bash

scp -i ~/.ssh/xmobile -P 2222 ubuntu@216.250.13.115:/home/ubuntu/db_backup/db_backup.sql /Users/intizar/Intizar/xmobile-v1/backup/db_backup.sql
scp -i ~/.ssh/xmobile -P 2222 ubuntu@216.250.13.115:/home/ubuntu/tar-file/images.tar.gz /Users/intizar/Intizar/xmobile-v1/backup/images.tar.gz