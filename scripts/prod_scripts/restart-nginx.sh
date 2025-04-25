#!/bin/bash

sudo mv /home/ubuntu/xmobile-v1/nginx/default /etc/nginx/sites-available/default

if ! sudo nginx -t; then
    echo "NGINX config has errors."
    exit 1
fi

echo "NGINX config successfully compiled. Reloading service..."
sudo nginx -s reload