# Xmobile

## Setup

```bash
yarn install

docker-compose up -d db
yarn db:generate
yarn db:migrate

yarn dev
```

## CI/CD

1. Get the xmobile ssh public and private keys along with passphrase

2. Compile the app for ubuntu amd64

```bash
# one time, make scripts/build.sh executable
chmod +x scripts/build.sh

./scripts/build.sh <SSH_PASSPHRASE>
```

`build.sh` script installs the packages, compresses the whole repo to a `tar` file and copies it to the Telekom VM to the following directory: `/home/ubuntu/tar-file/xmobile-v1.tar.gz`. It's necessary to install packages on your device since the `npm registry` is blocked by the telekom firewall

3. ssh into the VM, unpack the `tar` file, and copy (overwrite) ONLY the `src` dir to `xmobile-v1`

4. Build and restart the app

```bash
yarn build
./restart-server.sh
```

## Tunnel to Telekom VM

```bash
# SSH to AWS EC2 Instance (Bastion Host)
ssh -i ~/.ssh/aws_proxy_tunnel.pem -L 2222:216.250.13.115:2222 ubuntu@3.87.187.215

# SSH into the Target VM
ssh -i ~/.ssh/xmobile -p 2222 ubuntu@localhost

# SCP into the Target VM
scp -i ~/.ssh/xmobile -P 2222 xmobile-v1.tar.gz ubuntu@localhost:/home/ubuntu/tar-file/xmobile-v1.tar.gz

```

## Features

- left side menu with categories and products
- top menu
- search functionality
- login for admin users
- saved products for users (cart)
- language feature (tm, ru, en)
- voting system for a product
- new products category
  - ask to add to this category when a new product is added to any other category
  - automatically remove every 1 month (configurable)
- photo/video advertisement adding feature
- sample UI designs:
  - [akyol.comt.tm](https://akyol.com.tm/index.php?route=product/category&path=72_214)
  - [mobile.com.tm](https://mobile.com.tm/products?category=2)
  - [gerekli.tm](https://gerekli.tm)
