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
