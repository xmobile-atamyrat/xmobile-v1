#!/bin/bash

SSH_PASSPHRASE=$1

main() {
    if [[ -z "$SSH_PASSPHRASE" ]]; then
        echo "Skipping docker operations. Provide SSH_PASSPHRASE as the first argument to run docker operations"
    else
        docker-compose up -d build_env
        docker exec build_env sh -c 'rm -rf /app/xmobile-v1 && rm -f /app/xmobile-v1.tar.gz'
        docker exec -e SSH_PASSPHRASE="$SSH_PASSPHRASE" build_env sh -c '
            eval $(ssh-agent -s) && \
            echo "$SSH_PASSPHRASE" | ssh-add /root/.ssh/id_rsa && \
            ssh-keyscan github.com >> /root/.ssh/known_hosts && \
            mkdir -p /app/xmobile-v1 && \
            git clone git@github.com:xmobile-atamyrat/xmobile-v1.git /app/xmobile-v1 && \
            cd /app/xmobile-v1 && \
            yarn install --production && \
            tar -czvf /app/xmobile-v1.tar.gz /app/xmobile-v1
        '
        docker cp build_env:/app/xmobile-v1.tar.gz .
    fi

    scp -P 2222 -i ~/.ssh/xmobile xmobile-v1.tar.gz ubuntu@216.250.13.97:/home/ubuntu/tar-file/xmobile-v1.tar.gz

    rm xmobile-v1.tar.gz
}

main