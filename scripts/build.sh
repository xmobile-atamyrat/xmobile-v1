#!/bin/bash

SSH_PASSPHRASE=$1

handle_build_env_container() {
    # if container is running then restart
    if docker ps | grep -q build_env; then
        docker exec build_env sh -c 'rm -rf /app/xmobile-v1 && rm /app/xmobile-v1.tar.gz'
    else
        echo "starting build_env container..."
        docker-compose up -d build_env
    fi
}

main() {
    if [[ -z "$SSH_PASSPHRASE" ]]; then
        echo "Skipping docker operations. Provide SSH_PASSPHRASE as the first argument to run docker operations"
    else
        handle_build_env_container
        docker exec -e SSH_PASSPHRASE="$SSH_PASSPHRASE" build_env sh -c '
            eval $(ssh-agent -s) && \
            echo "$SSH_PASSPHRASE" | ssh-add /root/.ssh/id_rsa && \
            ssh-keyscan github.com >> /root/.ssh/known_hosts && \
            mkdir -p /app/xmobile-v1 && \
            git clone git@github.com:xmobile-atamyrat/xmobile-v1.git /app/xmobile-v1 && \
            cd /app/xmobile-v1 && \
            yarn install && \
            tar -czvf /app/xmobile-v1.tar.gz /app/xmobile-v1
        '
        docker cp build_env:/app/xmobile-v1.tar.gz .
    fi

    scp -P 2222 -i ~/.ssh/xmobile xmobile-v1.tar.gz ubuntu@216.250.13.97:/home/ubuntu/tar-file/xmobile-v1.tar.gz
}

main