import dbClient from '../../../src/lib/dbClient';
import {
  createFCMNotificationPayload,
  sendFCMNotificationToUser,
} from '../../../src/lib/fcm/fcmService';
import { getSlack } from '../../../src/lib/slack';

const INTERVAL_MS = 60_000; // every minute
const BATCH_SIZE = 100;
// Don't resurrect stale notifications — matches the 24h FCM TTL in the payload.
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

interface BackoffConfig {
  baseDelaySec: number;
  backoffMultiplier: number;
  maxDelaySec: number;
}

/**
 * Delay (seconds) to wait after a failed attempt, given how many retries have
 * already happened. Exponential, capped at maxDelaySec.
 *   retryCount 0 -> base, 1 -> base*mult, 2 -> base*mult^2, ...
 */
export function computeBackoffSec(
  retryCount: number,
  cfg: BackoffConfig,
): number {
  const raw = cfg.baseDelaySec * cfg.backoffMultiplier ** retryCount;
  return Math.min(Math.round(raw), cfg.maxDelaySec);
}

const DEFAULT_CONFIG = {
  enabled: true,
  maxRetries: 3,
  baseDelaySec: 30,
  backoffMultiplier: 2.0,
  maxDelaySec: 3600,
};

async function runNotificationRetryInner(): Promise<void> {
  const cfg = await dbClient.pushRetryConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...DEFAULT_CONFIG },
  });

  if (!cfg.enabled) return;

  const now = new Date();
  const windowCutoff = new Date(now.getTime() - RETRY_WINDOW_MS);

  // Rows that aged out of the retry window while still PENDING would otherwise
  // sit forever claiming they'll be retried — they won't, so close them out.
  const expired = await dbClient.inAppNotification.updateMany({
    where: { deliveryStatus: 'PENDING', createdAt: { lt: windowCutoff } },
    data: { deliveryStatus: 'FAILED', lastError: 'retry window expired' },
  });

  const due = await dbClient.inAppNotification.findMany({
    where: {
      deliveryStatus: 'PENDING',
      retryCount: { lt: cfg.maxRetries },
      createdAt: { gte: windowCutoff },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  });

  let sent = 0;
  let exhausted = 0;

  if (due.length > 0) {
    // Retries are independent; fan out in parallel (same pattern as the order-service
    // notification sends). ponytail: FCM only — the batch process holds no live WS
    // connections, and FCM is the durable retry channel; WS fallback stays in the API path.
    const outcomes = await Promise.allSettled(
      due.map(async (n): Promise<'sent' | 'pending' | 'failed'> => {
        const payload = createFCMNotificationPayload(n);
        const result = await sendFCMNotificationToUser(n.userId, payload).catch(
          () => ({
            success: false,
            tokensSent: 0,
            tokensFailed: 0,
            failedTokenIds: [],
          }),
        );

        const attempt = n.retryCount + 1;

        if (result.tokensSent > 0) {
          await dbClient.inAppNotification.update({
            where: { id: n.id },
            data: {
              deliveryStatus: 'SENT',
              retryCount: attempt,
              lastAttemptAt: now,
              nextRetryAt: null,
              lastError: null,
            },
          });
          return 'sent';
        }

        const isExhausted = attempt >= cfg.maxRetries;
        await dbClient.inAppNotification.update({
          where: { id: n.id },
          data: {
            deliveryStatus: isExhausted ? 'FAILED' : 'PENDING',
            retryCount: attempt,
            lastAttemptAt: now,
            nextRetryAt: isExhausted
              ? null
              : new Date(
                  now.getTime() + computeBackoffSec(n.retryCount, cfg) * 1000,
                ),
            lastError:
              result.tokensFailed > 0
                ? `${result.tokensFailed} token(s) failed`
                : 'no active tokens',
          },
        });
        return isExhausted ? 'failed' : 'pending';
      }),
    );

    sent = outcomes.filter(
      (o) => o.status === 'fulfilled' && o.value === 'sent',
    ).length;
    exhausted = outcomes.filter(
      (o) => o.status === 'fulfilled' && o.value === 'failed',
    ).length;
  }

  const newlyFailed = exhausted + expired.count;

  if (newlyFailed > 0) {
    const slack = getSlack('HEALTH_BOT_WEBHOOK');
    await slack
      ?.send(
        `:x: *Push notifications permanently failed*\nCount: ${newlyFailed}\n(retries exhausted or 24h retry window expired)`,
      )
      .catch((err) =>
        console.error('[NotificationRetry] Failed to send Slack alert:', err),
      );
  }

  if (due.length > 0 || newlyFailed > 0) {
    console.log(
      `[NotificationRetry] processed ${due.length} (sent ${sent}, newly-failed ${newlyFailed}).`,
    );
  }
}

// ponytail: single-process guard so a slow tick (FCM can hang on the sinkholed
// VM) can't overlap the next one and re-send the same PENDING rows. Needs a DB
// lock only if the runner ever goes multi-instance.
let running = false;

async function runNotificationRetry(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runNotificationRetryInner();
  } finally {
    running = false;
  }
}

export const notificationRetryJob = {
  id: 'notification-retry',
  schedule: { type: 'interval' as const, ms: INTERVAL_MS },
  run: runNotificationRetry,
};

// Self-check: backoff must be monotonic non-decreasing and capped at maxDelaySec.
if (require.main === module) {
  const cfg = { baseDelaySec: 30, backoffMultiplier: 2, maxDelaySec: 3600 };
  const seq = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => computeBackoffSec(n, cfg));
  for (let i = 1; i < seq.length; i += 1) {
    if (seq[i] < seq[i - 1]) throw new Error(`backoff not monotonic: ${seq}`);
    if (seq[i] > cfg.maxDelaySec)
      throw new Error(`backoff exceeds cap: ${seq}`);
  }
  if (seq[0] !== 30) throw new Error(`first delay should be base: ${seq[0]}`);
  console.log('computeBackoffSec self-check passed:', seq);
}
