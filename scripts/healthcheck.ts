import https from 'https';
import { getSlack } from '../src/lib/slack';

const PING_URL = 'https://xmobile.com.tm/api/ping';
const CHECK_INTERVAL_MS = 5000;
const TIMEOUT_MS = 10000;
const FAILURE_THRESHOLD = 3;
const SLACK_BOT_NAME = 'HEALTH_BOT_WEBHOOK'; // Maps to SLACK_HEALTH_BOT_WEBHOOK

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

function checkHealth() {
  const req = https.get(PING_URL, { timeout: TIMEOUT_MS }, (res) => {
    const { statusCode } = res;

    if (statusCode === 200) {
      handleSuccess();
    } else {
      handleFailure(`Received status code: ${statusCode}`);
    }

    // Consume response data to free up memory
    res.resume();
  });

  req.on('error', (err) => {
    handleFailure(`Request error: ${err.message}`);
  });

  req.on('timeout', () => {
    req.destroy();
    handleFailure('Request timeout');
  });
}

// Start the check loop
console.log(
  `[Healthcheck] Starting monitoring for ${PING_URL} every ${CHECK_INTERVAL_MS}ms...`,
);
setInterval(checkHealth, CHECK_INTERVAL_MS);

// Run initial check immediately
checkHealth();
