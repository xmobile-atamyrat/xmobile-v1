#!/bin/bash

SSH_PASSPHRASE=$1

if [[ -z "$SSH_PASSPHRASE" ]]; then
    echo "SSH_PASSPHRASE is required"
    exit 1
fi

docker build --build-arg SSH_PASSPHRASE="$SSH_PASSPHRASE" -t build_env .
docker run -d --name build_env build_env
docker cp build_env:/app/xmobile-v1.tar.gz .