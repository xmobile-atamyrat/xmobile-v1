'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.telekomBalanceJob = void 0;
const slack_1 = require('../../../src/lib/slack');
const telekom_1 = require('../../../src/lib/telekom');
const SLACK_BOT_NAME = 'HEALTH_BOT_WEBHOOK';
// const DEFAULT_CRON = '0 9 * * *'; // 09:00 daily
const DEFAULT_CRON = '* * * * *'; // for testing: every min
function getThresholdTmt() {
  const raw = process.env.TELEKOM_BALANCE_ALERT_THRESHOLD_TMT;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
async function runTelekomBalanceCheck() {
  const threshold = getThresholdTmt();
  if (threshold == null) {
    console.log(
      '[TelekomBalance] TELEKOM_BALANCE_ALERT_THRESHOLD_TMT not set, skipping alert check.',
    );
    return;
  }
  const balance = await (0, telekom_1.fetchTelekomBalance)();
  if (balance == null) {
    console.warn(
      '[TelekomBalance] Could not fetch balance (missing creds or API error).',
    );
    return;
  }
  if (balance < threshold) {
    const slack = (0, slack_1.getSlack)(SLACK_BOT_NAME);
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
exports.telekomBalanceJob = {
  id: 'telekom-balance',
  schedule: { type: 'cron', expr: DEFAULT_CRON },
  run: runTelekomBalanceCheck,
};
