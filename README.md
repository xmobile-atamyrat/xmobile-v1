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

4. Build and restart the app

```bash
yarn build
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

# delete the current db container and volume and then:
docker-compose up db -d

# exec into db container (from daemon):
psql -U postgres;
create user xmobile with password 'password';
alter user xmobile superuser;

# from terminal:
docker cp backup/db_backup.sql db:/db_backup.sql
docker exec -it db bash -c "PGPASSWORD='password' pg_restore -U xmobile -d postgres /db_backup.sql"

# from repo root:
tar -xzvf backup/images.tar.gz -C backup
chmod +x scripts/update-db-img-urls.sh
./scripts/update-db-img-urls.sh
```
