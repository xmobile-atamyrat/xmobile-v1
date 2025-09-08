#!/bin/bash

OLD_FLAG=$1

cd /home/ubuntu/tar-file

if [[ -n "$OLD_FLAG" ]]; then
	echo "Rolling back with xmobile-v1-old.tar.gz"
	tar -xf xmobile-v1-old.tar.gz
else
	echo "Deploying with xmobile-v1.tar.gz"
	tar -xf xmobile-v1.tar.gz
fi

cd /home/ubuntu/xmobile-v1

echo "Copying the 'src'"
rm -rf src
mv /home/ubuntu/tar-file/app/xmobile-v1/src .
        
echo "Copying the 'prisma'"
rm -rf prisma
mv /home/ubuntu/tar-file/app/xmobile-v1/prisma .
yarn db:generate
yarn db:migrate
        
echo "Copying the 'node_modules'"
rm -rf node_modules
mv /home/ubuntu/tar-file/app/xmobile-v1/node_modules .
        
echo "Copying the 'public'"
rm -rf public
mv /home/ubuntu/tar-file/app/xmobile-v1/public .

echo "Copying the 'nginx'"
rm -rf nginx
mv /home/ubuntu/tar-file/app/xmobile-v1/nginx .

echo "Copying 'package.json'"
mv /home/ubuntu/tar-file/app/xmobile-v1/package.json .

echo "Copying 'yarn.lock'"
mv /home/ubuntu/tar-file/app/xmobile-v1/yarn.lock .

echo "Copying 'next.config.mjs'"
mv /home/ubuntu/tar-file/app/xmobile-v1/next.config.mjs .

echo "Copying 'tsconfig.json' & 'tsconfig.ws.json'"
mv /home/ubuntu/tar-file/app/xmobile-v1/tsconfig.json .
mv /home/ubuntu/tar-file/app/xmobile-v1/tsconfig.ws.json .

echo "Copying 'tailwind.config.ts'"
mv /home/ubuntu/tar-file/app/xmobile-v1/tailwind.config.ts .

rm -rf .next
yarn build
yarn build:ws
/home/ubuntu/scripts/restart-server.sh

cd /home/ubuntu/tar-file
rm -rf app
