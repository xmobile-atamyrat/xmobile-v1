import { getSlack } from '../../../src/lib/slack';
import { fetchTelekomBalance } from '../../../src/lib/telekom';

const SLACK_BOT_NAME = 'HEALTH_BOT_WEBHOOK';
// const DEFAULT_CRON = '0 9 * * *'; // 09:00 daily
const DEFAULT_CRON = '* * * * *'; // for testing: every min

function getThresholdTmt(): number | null {
  const raw = process.env.TELEKOM_BALANCE_ALERT_THRESHOLD_TMT;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function runTelekomBalanceCheck(): Promise<void> {
  const threshold = getThresholdTmt();
  if (threshold == null) {
    console.log(
      '[TelekomBalance] TELEKOM_BALANCE_ALERT_THRESHOLD_TMT not set, skipping alert check.',
    );
    return;
  }

  const balance = await fetchTelekomBalance();
  if (balance == null) {
    console.warn(
      '[TelekomBalance] Could not fetch balance (missing creds or API error).',
    );
    return;
  }

  if (balance < threshold) {
    const slack = getSlack(SLACK_BOT_NAME);
    if (!slack) {
      console.error(
        `[TelekomBalance] Slack client '${SLACK_BOT_NAME}' not found.`,
      );
      return;
    }
    await slack.send(
      `:warning: *Telekom balance low*\nBalance: *${balance} TMT*\nThreshold: ${threshold} TMT`,
    );
    console.log(
      `[TelekomBalance] Alert sent: balance ${balance} TMT < ${threshold} TMT`,
    );
  } else {
    console.log(
      `[TelekomBalance] Balance ${balance} TMT is above threshold ${threshold} TMT`,
    );
  }
}

export const telekomBalanceJob = {
  id: 'telekom-balance',
  schedule: { type: 'cron' as const, expr: DEFAULT_CRON },
  run: runTelekomBalanceCheck,
};
