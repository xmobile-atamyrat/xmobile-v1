# Build and Deploy (GitHub Actions)

The workflow **Build and Deploy** (`.github/workflows/build-and-deploy.yml`) builds a commit and deploys it to the VM on Telekom Cloud. Tar files on the VM are named by commit hash, e.g. `xmobile-v1-abc1234.tar.gz`. If that tar already exists on the VM, only the deploy steps run (no upload).

## Required repository secrets

Configure these in **Settings → Secrets and variables → Actions** (only users with write/admin access can view or edit them):

| Secret | Description |
|--------|-------------|
| `VM_HOST` | VM hostname or IP (e.g. `1.2.3.4` or `vm.example.com`) |
| `VM_USER` | SSH user (e.g. `ubuntu`) |
| `VM_SSH_PRIVATE_KEY` | Full contents of the private key used to SSH to the VM |
| `VM_SSH_KEY_PASSPHRASE` | Passphrase for the private key (leave empty if the key has no passphrase) |
| `VM_SSH_PORT` | SSH port (e.g. `2222`) |

## How to run

1. In the repo go to **Actions → Build and Deploy**.
2. Click **Run workflow**.
3. Enter a **branch name** (e.g. `main`) or a **commit hash** in "Branch name or commit hash to deploy". Default is `main`.
4. Click **Run workflow** (green button).

The workflow will:

- Resolve the ref to a commit and build a tar named `xmobile-v1-<short-sha>.tar.gz`.
- If the VM already has that tar under `/home/ubuntu/tar-file/`, skip upload.
- On the VM: extract the tar, copy files to `/home/ubuntu/xmobile-v1`, run `yarn db:generate-prod`, `yarn db:migrate-prod`, `yarn build`, `yarn build:ws`, then restart the server.

To deploy an older commit, run the workflow again with that commit hash; if that commit’s tar is still on the VM, it will only re-run the deploy steps.
