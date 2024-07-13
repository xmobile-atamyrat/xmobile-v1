#!/bin/bash

SSH_PASSPHRASE=$1

if [[ -z "$SSH_PASSPHRASE" ]]; then
    echo "Skipping docker operations. Provide SSH_PASSPHRASE as the first argument to run docker operations"
else
    docker build --build-arg SSH_PASSPHRASE="$SSH_PASSPHRASE" -t build_env .
    docker run -d --name build_env build_env
    docker cp build_env:/app/xmobile-v1.tar.gz .
fi

scp -P 2222 -i ~/.ssh/xmobile xmobile-v1.tar.gz ubuntu@216.250.13.97:/home/ubuntu/tar-file/xmobile-v1.tar.gz