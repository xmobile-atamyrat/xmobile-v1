#!/bin/bash

OLD_FILE="/home/ubuntu/tar-file/xmobile-v1-old.tar.gz"
UPDATE_SERVER="/home/ubuntu/scripts/update-server-source.sh"

if [ -f $OLD_FILE ]; then
    echo "Rollback started."
    if [ -f $UPDATE_SERVER ]; then
        $UPDATE_SERVER old

        echo "Deleting xmobile-v1.tar.gz file.."
        rm -f /home/ubuntu/tar-file/xmobile-v1.tar.gz

        echo "Renaming xmobile-v1-old.tar.gz to xmobile-v1.tar.gz.."
        mv /home/ubuntu/tar-file/xmobile-v1-old.tar.gz /home/ubuntu/tar-file/xmobile-v1.tar.gz

        echo "Rollback Finished."
    else
        echo "$UDPATE_SERVER not found. Rollback canceled"
    fi
else
    echo "$OLD_FILE not found. Rollback is possible once"
fi

