# Build and Deploy (GitHub Actions)

The workflow **Build and Deploy** (`.github/workflows/build-and-deploy.yml`) builds a commit and deploys it to the VM on Telekom Cloud.

## Flow

1. **Resolve** – The input ref (branch or commit hash) is resolved to a short commit SHA.
2. **Check VM** – The build job checks whether `/home/ubuntu/tar-file/xmobile-v1-<short-sha>.tar.gz` already exists on the VM.
3. **Build** (only if tar is missing) – In CI: checkout, `yarn install`, `npx prisma generate`, `yarn build`, `yarn build:ws`. The tar includes source, `node_modules`, and **pre-built** `.next` and `dist`, so no build runs on the VM.
4. **Deploy** – Extract the tar on the VM, copy files to `/home/ubuntu/xmobile-v1`, run `yarn db:generate-prod`, `yarn db:migrate-prod`, then restart the server. No `yarn build` / `yarn build:ws` on the VM.
5. **Prune** – Only the 3 most recent tar files (by modification time) are kept on the VM; older ones are deleted.

**Rollback:** Run the workflow with an older commit hash. If that commit’s tar is still on the VM, the build is skipped and only deploy runs.

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

---

## Deploy Batch Runner

The workflow **Deploy Batch Runner** (`.github/workflows/deploy-healthcheck.yml`) builds and deploys the central batch/cron runner to the VM. This single process runs:

- **healthcheck** – Pings the app every 5s; sends Slack on down/recovery (same behavior as the old standalone healthcheck).
- **telekom-balance** – Runs daily at 09:00; if balance &lt; `TELEKOM_BALANCE_ALERT_THRESHOLD_TMT` (env), sends a Slack alert.

### Flow

1. Checkout, install deps, run `yarn build:batch-runner`.
2. Upload `batch-runner-dist/` to `$APP_DIR_ON_VM/batch-runner-dist/` on the VM.
3. Run `/home/ubuntu/scripts/restart-healthcheck.sh` on the VM.

### VM setup

On the VM, the script that restarts the service (e.g. `restart-healthcheck.sh`) should start the batch runner, for example:

```bash
cd /home/ubuntu/xmobile-v1 && node --env-file=.env batch-runner-dist/scripts/batch-runner/index.js
```

Or use `yarn start:batch-runner` if the app dir has `package.json` and `batch-runner-dist/` in place.

Required env (in `.env` on the VM): `SLACK_HEALTH_BOT_WEBHOOK`, and for telekom alerts: `TELEKOM_USERNAME`, `TELEKOM_PASSWORD`, `TELEKOM_BALANCE_ALERT_THRESHOLD_TMT` (number in TMT; alert is sent when balance is below this).
