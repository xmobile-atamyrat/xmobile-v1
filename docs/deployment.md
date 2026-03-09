# Deployment (GitHub Actions)

This page documents the GitHub Actions workflows for building, deploying, and backing up the app on the VM.

## Build and Deploy

The workflow **Build and Deploy** (`.github/workflows/build-and-deploy.yml`) builds a commit and deploys it to the VM on Telekom Cloud.

## Flow

1. **Resolve** – The input ref (branch or commit hash) is resolved to a short commit SHA.
2. **Check VM** – The build job checks whether `/home/ubuntu/tar-file/xmobile-v1-<short-sha>.tar.gz` already exists on the VM.
3. **Build** (only if tar is missing) – In CI: checkout, `yarn install`, `npx prisma generate`, `yarn build`, `yarn build:ws`. The tar includes source, `node_modules`, and **pre-built** `.next` and `dist`, so no build runs on the VM.
4. **Deploy** – Extract the tar on the VM, copy files to `/home/ubuntu/xmobile-v1`, run `yarn db:generate-prod`, `yarn db:migrate-prod`, then restart the server. No `yarn build` / `yarn build:ws` on the VM.
5. **Prune** – Only the 3 most recent tar files (by modification time) are kept on the VM; older ones are deleted.

**Rollback:** Run the workflow with an older commit hash. If that commit's tar is still on the VM, the build is skipped and only deploy runs.

## Required repository secrets

Configure these in **Settings → Secrets and variables → Actions** (only users with write/admin access can view or edit them):

| Secret | Description |
|--------|-------------|
| `VM_HOST` | VM hostname or IP (e.g. `1.2.3.4` or `vm.example.com`) |
| `VM_USER` | SSH user (e.g. `ubuntu`) |
| `VM_SSH_PORT` | SSH port (e.g. `2222`) |
| `VM_SSH_PRIVATE_KEY` | Full contents of the private key used to SSH to the VM |
| `VM_SSH_KEY_PASSPHRASE` | Passphrase for the private key (leave empty if the key has no passphrase) |

## How to run

1. Go to **Actions → Build and Deploy**.
2. Click **Run workflow**.
3. Enter a **branch name** (e.g. `main`) or a **commit hash** in "Branch name or commit hash to deploy". Default is `main`.
4. Click **Run workflow** (green button).

## VM paths

- Tar files: `/home/ubuntu/tar-file/`
- App directory: `/home/ubuntu/xmobile-v1/`
- Restart script: `/home/ubuntu/scripts/restart-server.sh`

Tar retention is controlled by `TAR_FILES_TO_KEEP` in the workflow (default: 3).

## Deploy Batch Runner

The workflow **Deploy Batch Runner** (`.github/workflows/deploy-batch-runner.yml`) builds and deploys the central batch/cron runner to the VM. This single process runs:

- **healthcheck** – Pings the app every 5s; sends Slack on down/recovery.
- **telekom-balance** – Runs daily at 09:00; if balance &lt; `TELEKOM_BALANCE_ALERT_THRESHOLD_TMT` (env), sends a Slack alert.

### Flow

1. Checkout, install deps, run `yarn build:batch-runner`.
2. Upload `batch-runner-dist/` to `$APP_DIR_ON_VM/batch-runner-dist/` on the VM.
3. Run `/home/ubuntu/scripts/restart-batch-runner.sh` on the VM.

### VM setup

On the VM, the script that restarts the service (e.g. `restart-batch-runner.sh`) should start the batch runner, for example:

```bash
cd /home/ubuntu/xmobile-v1 && node --env-file=.env batch-runner-dist/scripts/batch-runner/batch-runner.js
```

Or use `yarn start:batch-runner` if the app dir has `package.json` and `batch-runner-dist/` in place.

Required env (in `.env` on the VM): `SLACK_HEALTH_BOT_WEBHOOK`, and for telekom alerts: `TELEKOM_USERNAME`, `TELEKOM_PASSWORD`, `TELEKOM_BALANCE_ALERT_THRESHOLD_TMT` (number in TMT; alert is sent when balance is below this).

## Daily Backup to Drive

The workflow **Daily Backup to Drive** (`.github/workflows/backup-to-drive.yml`) runs a full backup on the VM, copies the dump and images to the runner, uploads them to Google Drive, and prunes old backups.

### Triggers

- **Schedule:** Every day at **00:00 UTC**.
- **Manual:** **Actions → Daily Backup to Drive → Run workflow**.

### Flow

1. **SSH to VM** – Uses the same VM secrets as Build and Deploy.
2. **Run backup on VM** – Executes `/home/ubuntu/scripts/backup-data.sh all` on the VM (creates `db_backup.sql` and `images.tar.gz`).
3. **Copy to runner** – SCP of `images.tar.gz` and `db_backup.sql` from the VM to the runner.
4. **Upload to Google Drive** – rclone uploads to a date-named subfolder (e.g. `2025-03-09/`) inside the folder identified by `GDRIVE_FOLDER_ID`.
5. **Prune** – Keeps only the latest 3 backup folders; older date folders are deleted.

### Required repository secrets (in addition to VM secrets)

| Secret | Description |
|--------|-------------|
| `GDRIVE_FOLDER_ID` | Google Drive folder ID (from the folder URL: `drive.google.com/.../folders/<ID>`). Must be a folder in **your** My Drive that you shared with the service account. |
| `GDRIVE_SA_JSON` | Full contents of the Google Cloud service account JSON key file. |

### Google Drive setup

Service accounts have no storage quota of their own. Uploads must go into a folder in **your** Drive that you share with the service account.

1. Create a Google Cloud project, enable **Google Drive API**, and create a **service account** with a JSON key.
2. In Google Drive (your account), create the target folder (e.g. `xmobile/backup` under My Drive).
3. Open that folder and copy the **folder ID** from the URL: `https://drive.google.com/drive/folders/<FOLDER_ID>`.
4. **Share the folder** with the service account email (e.g. `xxx@yyy.iam.gserviceaccount.com`) with **Editor** access.
5. Add the folder ID as the `GDRIVE_FOLDER_ID` secret in GitHub. Date subfolders (YYYY-MM-DD) will be created inside this folder.

### VM requirements

- `/home/ubuntu/scripts/backup-data.sh` must exist and be executable.
- Script writes: `/home/ubuntu/db_backup/db_backup.sql`, `/home/ubuntu/tar-file/images.tar.gz`.
