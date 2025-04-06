#!/bin/bash

SSH_PASSPHRASE=$1

main() {
    if [[ -z "$SSH_PASSPHRASE" ]]; then
        echo "Skipping docker operations. Provide SSH_PASSPHRASE as the first argument to run docker operations"
    else
        docker-compose up -d build_env
        docker exec build_env sh -c '[ -d /app/xmobile-v1 ] && rm -rf /app/xmobile-v1 && [ -f /app/xmobile-v1.tar.gz ] && rm -f /app/xmobile-v1.tar.gz'
        docker exec -e SSH_PASSPHRASE="$SSH_PASSPHRASE" build_env sh -c '
            eval $(ssh-agent -s) && \
            echo "$SSH_PASSPHRASE" | ssh-add /root/.ssh/id_rsa && \
            ssh-keyscan github.com >> /root/.ssh/known_hosts && \
            mkdir -p /app/xmobile-v1 && \
            git clone git@github.com:xmobile-atamyrat/xmobile-v1.git /app/xmobile-v1 && \
            cd /app/xmobile-v1 && \
            rm -rf .env.local && \
            yarn cache clean && yarn install --force && \
            tar -czvf /app/xmobile-v1.tar.gz /app/xmobile-v1
        '
        docker cp build_env:/app/xmobile-v1.tar.gz .

        # remove old tar file and rename the recent one to old
        ssh xmobile "rm -f /home/ubuntu/tar-file/xmobile-v1-old.tar.gz && mv /home/ubuntu/tar-file/xmobile-v1.tar.gz /home/ubuntu/tar-file/xmobile-v1-old.tar.gz"

        # copy the new tar file
        scp xmobile-v1.tar.gz xmobile:/home/ubuntu/tar-file/xmobile-v1.tar.gz
    fi
}

main