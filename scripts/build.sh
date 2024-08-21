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
            rm -rf .env.local && \
            yarn install && \
            tar -czvf /app/xmobile-v1.tar.gz /app/xmobile-v1
        '
        docker cp build_env:/app/xmobile-v1.tar.gz .
    fi

    # Establish SSH tunnel to AWS EC2 Instance (Bastion Host)
    # ssh -i ~/.ssh/aws_proxy_tunnel.pem -L 2222:216.250.13.115:2222 -N -f ubuntu@3.87.187.215

    # SCP the file through the tunnel to the target VM
    # scp -i ~/.ssh/xmobile -P 2222 xmobile-v1.tar.gz ubuntu@localhost:/home/ubuntu/tar-file/xmobile-v1.tar.gz

    # Close the SSH tunnel
    # ssh -O exit -i ~/.ssh/aws_proxy_tunnel.pem ubuntu@3.87.187.215

    scp -i ~/.ssh/xmobile -P 2222 xmobile-v1.tar.gz ubuntu@216.250.13.115:/home/ubuntu/tar-file/xmobile-v1.tar.gz

    rm -f xmobile-v1.tar.gz
}

main