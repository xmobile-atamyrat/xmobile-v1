# Xmobile

An open-source e-commerce platform based in Turkmenistan, designed to introduce online payment and delivery systems. If you're looking to sharpen your web or mobile app development skills by working on complex systems, you're in the right place! The web is hosted at [xmobile.com.tm](xmobile.com.tm)

## To contribute

- Fork the repo and make a PR to the source
- Creating issues is enabled on the repo

## Setup

```bash
yarn install

docker-compose up -d db
yarn db:generate
yarn db:migrate

yarn dev
```

### Websocket-Server Setup
Run websocket server to enable user-admin chat feature. Websocket-server runs on seperate http server with port 4000. More information at [link](/src/ws-server/README.md).
```bash
yarn dev:ws
```

### Docker Setup

```bash
psql -U postgres
create user xmobile with password 'password';
grant all privileges on database postgres to xmobile;
alter user xmobile createdb;
grant all on schema public to xmobile;
```

## CI/CD (for internal)

1. Get the xmobile ssh public and private keys along with passphrase

2. Compile the app for ubuntu amd64

```bash
# one time, make scripts/build.sh executable
chmod +x scripts/build.sh

./scripts/build.sh <SSH_PASSPHRASE>
```

`build.sh` script installs the packages, compresses the whole repo to a `tar` file and copies it to the Telekom VM to the following directory: `/home/ubuntu/tar-file/xmobile-v1.tar.gz`. It's necessary to install packages on your device since the `npm registry` is blocked by the telekom firewall

3. ssh into the VM, unpack the `tar` file, and copy (overwrite) ONLY the `src` dir to `xmobile-v1`

4. Build the app, websocket-server and restart the app

```bash
yarn build
yarn build:ws
./restart-server.sh
```

## Tunnel to Telekom VM (for internal)

```bash
# SSH to AWS EC2 Instance (Bastion Host)
ssh -i ~/.ssh/aws_proxy_tunnel.pem -L 2222:216.250.13.115:2222 ubuntu@3.87.187.215

# SSH into the Target VM
ssh -i ~/.ssh/xmobile -p 2222 ubuntu@localhost

# SCP into the Target VM
scp -i ~/.ssh/xmobile -P 2222 xmobile-v1.tar.gz ubuntu@localhost:/home/ubuntu/tar-file/xmobile-v1.tar.gz
```

## Backup data (for internal)

```bash
ssh xmobile
./scripts/backup-data.sh
exit

./scripts/backup-production-data.sh
./scripts/apply-backup.sh all # Note: apply-backup options are 'db', 'images', 'all'
```
