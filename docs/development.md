# Development

Day-to-day workflow for contributors.

## Environment

- **Local:** Copy `.env.example` to `.env.local`, set at least `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`.
- **Reference:** [Environment](environment.md) lists all vars.

## Running the app

- **Web:** `yarn dev` → http://localhost:3003.
- **WebSocket server (chat):** In a second terminal, `yarn dev:ws`. Needs same `.env.local` (and `DATABASE_URL`, WS-related vars if used).
- **Batch-runner:** `yarn build:batch-runner` then `yarn start:batch-runner`. Uses `.env` (or env file you pass). See `scripts/batch-runner/README.md`.

## Database

- **Generate client:** `yarn db:generate-dev`
- **Migrations:** `yarn db:migrate-dev`
- **Inspect data:** `yarn db:studio-dev`

## Lint / format

- **Lint:** `yarn lint`
- **Format:** Prettier (and lint-staged on commit via Husky).

## Mobile

- From `mobile/` install deps and run iOS/Android toolchain. See `mobile/` README or project docs if present. Backend URL is configured via env in the app.
