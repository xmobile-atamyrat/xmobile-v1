# Batch Runner

Central process that runs all periodic (cron/interval) jobs. Deploy once; it runs healthcheck, telekom-balance, and any jobs you add to the registry.

## Jobs

| Job              | Schedule   | Description |
|------------------|------------|-------------|
| healthcheck      | Every 5s   | Pings `/api/ping`; Slack on down/recovery |
| telekom-balance  | Daily 09:00| Fetches Telekom balance; Slack if below `TELEKOM_BALANCE_ALERT_THRESHOLD_TMT` |

## Adding a job

1. Create `scripts/batch-runner/jobs/<name>.ts` that exports a `BatchJob` (see `jobs/types.ts`).
2. Use `schedule: { type: 'interval', ms: N }` or `schedule: { type: 'cron', expr: '0 9 * * *' }`.
3. Register it in `scripts/batch-runner/jobs/registry.ts`.

## Env (on VM)

- `SLACK_HEALTH_BOT_WEBHOOK` – used by healthcheck and telekom-balance alerts.
- `TELEKOM_USERNAME`, `TELEKOM_PASSWORD` – for balance fetch.
- `TELEKOM_BALANCE_ALERT_THRESHOLD_TMT` – optional; if set, Slack when balance &lt; this (TMT).

## Run locally

```bash
yarn build:batch-runner
yarn start:batch-runner
```

Ensure `.env` has the vars above (and that `TELEKOM_BALANCE_ALERT_THRESHOLD_TMT` is set if you want daily alerts).
