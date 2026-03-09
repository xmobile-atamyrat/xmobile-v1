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

The workflow **Daily Backup to Drive** (`.github/workflows/backup-to-drive.yml`) has **two independent jobs** that run in parallel: one for the DB dump and one for images. If one job fails or times out (e.g. VM/network issues), the other can still succeed.

### Triggers

- **Schedule:** Every day at **00:00 UTC**.
- **Manual:** **Actions → Daily Backup to Drive → Run workflow**.

### Flow (each job runs in parallel)

**Job: Backup DB to Drive**  
1. SSH to VM → run `backup-data.sh db` → copy `db_backup.sql` to runner → configure rclone → upload to `gdrive:<date>/` → prune (keep 3) → delete `db_backup.sql` from VM.

**Job: Backup images to Drive**  
1. SSH to VM → run `backup-data.sh images` → copy `images.tar.gz` to runner → configure rclone → upload to `gdrive:<date>/` → prune (keep 3) → delete `images.tar.gz` from VM.

Both jobs write to the same date folder (e.g. `2025-03-09/`), so a successful run produces both `db_backup.sql` and `images.tar.gz` in that folder. Each job has its own 45-minute timeout.

### Required repository secrets (in addition to VM secrets)

| Secret | Description |
|--------|-------------|
| `GDRIVE_FOLDER_ID` | Google Drive folder ID. Open your backup folder in the browser; the ID is in the URL: `https://drive.google.com/drive/folders/<FOLDER_ID>`. |
| `GDRIVE_OAUTH_TOKEN` | rclone OAuth token (JSON). See below to obtain it. |

### Google Drive setup (OAuth)

The workflow uses **OAuth** (your Google account) so uploads use your Drive quota. Service accounts cannot use quota when creating new files in shared folders.

1. **Get the folder ID**  
   In Google Drive, open the folder where backups should go (e.g. `xmobile/backup`). Copy the folder ID from the URL: `https://drive.google.com/drive/folders/<FOLDER_ID>`. Add it as the `GDRIVE_FOLDER_ID` secret.

2. **Get the OAuth token**  
   On your machine, install [rclone](https://rclone.org/), then run:
   ```bash
   rclone config
   ```
   - Choose **n** (new remote), name it **gdrive**.
   - Storage: **Google Drive**.
   - Leave client_id and client_secret blank (use rclone’s defaults).
   - Scope: **1** (Full access).
   - Use **auto** config (opens the browser); sign in with the Google account that owns the backup folder.
   - Finish the wizard, then run:
   ```bash
   rclone config show gdrive
   ```
   Copy the entire **token** value (the JSON object on one line, e.g. `{"access_token":"...","refresh_token":"..."}`). Add it as the `GDRIVE_OAUTH_TOKEN` secret in GitHub (paste as a single line, no newlines).

### VM requirements

- `/home/ubuntu/scripts/backup-data.sh` must exist and be executable.
- Script writes: `/home/ubuntu/db_backup/db_backup.sql`, `/home/ubuntu/tar-file/images.tar.gz`.
