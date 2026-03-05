import https from 'https';
import { getSlack } from '../../../src/lib/slack';

const PING_URL = 'https://xmobile.com.tm/api/ping';
const CHECK_INTERVAL_MS = 5000;
const TIMEOUT_MS = 10000;
const FAILURE_THRESHOLD = 3;
const SLACK_BOT_NAME = 'HEALTH_BOT_WEBHOOK';

let failureCount = 0;
let isDown = false;

async function sendSlackAlert(message: string) {
  try {
    const slack = getSlack(SLACK_BOT_NAME);
    if (!slack) {
      console.error(
        `[Healthcheck] Slack client '${SLACK_BOT_NAME}' not found. Check SLACK_HEALTH_BOT_WEBHOOK env var.`,
      );
      return;
    }
    await slack.send(message);
    console.log('[Healthcheck] Slack alert sent.');
  } catch (error) {
    console.error('[Healthcheck] Failed to send Slack alert:', error);
  }
}

async function handleFailure(reason: string) {
  failureCount += 1;
  console.log(
    `[Healthcheck] Ping failed (${failureCount}/${FAILURE_THRESHOLD}): ${reason}`,
  );

  if (failureCount >= FAILURE_THRESHOLD && !isDown) {
    console.log(
      '[Healthcheck] Failure threshold reached. Marking server as DOWN.',
    );
    isDown = true;
    await sendSlackAlert(
      `:rotating_light: *Server Down*\nService at ${PING_URL} is failing checks.\nReason: ${reason}`,
    );
  }
}

async function handleSuccess() {
  if (failureCount > 0) {
    console.log(
      `[Healthcheck] Ping successful. Resetting failure count (was ${failureCount}).`,
    );
    failureCount = 0;
  }

  if (isDown) {
    console.log('[Healthcheck] Server recovered!');
    isDown = false;
    await sendSlackAlert(
      `:white_check_mark: *Server Recovered*\nService at ${PING_URL} is back online.`,
    );
  }
}

function checkHealth(): Promise<void> {
  return new Promise((resolve) => {
    const req = https.get(PING_URL, { timeout: TIMEOUT_MS }, (res) => {
      const { statusCode } = res;
      if (statusCode === 200) {
        handleSuccess().then(resolve).catch(resolve);
      } else {
        handleFailure(`Received status code: ${statusCode}`)
          .then(resolve)
          .catch(resolve);
      }
      res.resume();
    });

    req.on('error', (err) => {
      handleFailure(`Request error: ${err.message}`)
        .then(resolve)
        .catch(resolve);
    });

    req.on('timeout', () => {
      req.destroy();
      handleFailure('Request timeout').then(resolve).catch(resolve);
    });
  });
}

export const healthcheckJob = {
  id: 'healthcheck',
  schedule: { type: 'interval' as const, ms: CHECK_INTERVAL_MS },
  run: checkHealth,
};
