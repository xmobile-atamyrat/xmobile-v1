#!/bin/bash

arg=$1

copy_db() {
	scp xmobile:/home/ubuntu/db_backup/db_backup.sql ./backup/db_backup.sql
}

copy_images() {
	scp xmobile:/home/ubuntu/tar-file/images.tar.gz ./backup/images.tar.gz
}

if [ "$arg" == "db" ]; then
	copy_db
elif [ "$arg" == "images" ]; then
	copy_images
elif [ "$arg" == "all" ]; then
	copy_db
	copy_images
else
	echo "Provide an arg: db, images, all"
fi
