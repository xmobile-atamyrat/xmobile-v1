# Batch Runner

Central process that runs all periodic (cron/interval) jobs. Deploy once; it runs healthcheck, telekom-balance, and any jobs you add to the registry.

## Jobs

| Job                      | Schedule                       | Description                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| healthcheck              | Every 5s                       | Pings `/api/ping`; Slack on down/recovery                                                                                                                                                                                                  |
| telekom-balance          | Daily 09:00                    | Fetches Telekom balance; Slack if below `TELEKOM_BALANCE_ALERT_THRESHOLD_TMT`                                                                                                                                                              |
| admin-activity-retention | Daily 05:00                    | Deletes admin activity older than 13 months, in batches                                                                                                                                                                                    |
| price-staleness          | Daily 09:00 (Asia/Ashgabat)    | Counts products whose prices were not confirmed for 30+ / 90+ days; sends an in-app + push notification to admins (opens `/product/update-prices`); the title rotates daily through `PRICE_STALENESS_TITLES`. Skips when both counts are 0 |
| analytics-rollup         | Every 10 min (and at start-up) | Recomputes today's analytics rollups (`AnalyticsDaily`); also yesterday during the first hour after Ashgabat midnight                                                                                                                      |
| analytics-rollup-nightly | Daily 01:30 (Asia/Ashgabat)    | Finalizes yesterday, computes week/month unique visitors, and refreshes order-based metrics (revenue, completed orders, funnel) for the raw window                                                                                         |
| analytics-retention      | Daily 04:30 (Asia/Ashgabat)    | Deletes raw `AnalyticsEvent` rows older than 90 days, in batches                                                                                                                                                                           |

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
