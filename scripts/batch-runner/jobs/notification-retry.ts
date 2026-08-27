import dbClient from '../../../src/lib/dbClient';
import {
  createFCMNotificationPayload,
  sendFCMNotificationToUser,
  updateNotificationWithRetry,
} from '../../../src/lib/fcm/fcmService';
import { FCMSendResult } from '../../../src/lib/fcm/types';
import { getSlack } from '../../../src/lib/slack';

const INTERVAL_MS = 60_000; // every minute
const BATCH_SIZE = 100;
// Don't resurrect stale notifications — matches the 24h FCM TTL in the payload.
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
// Give the inline send path time to finish + record before the job may touch a
// row, or the job re-sends a push whose inline FCM call is still in flight.
const INLINE_SEND_GRACE_MS = 2 * 60_000;

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

// A notification that reached the user and got flagged as permanently failed.
interface FailedNotif {
  id: string;
  userId: string;
  type: string;
  retryCount: number;
  reason: string;
}

/**
 * Build a Slack alert that names *who* didn't get their push, not just a count.
 * ponytail: one extra user lookup per tick, only when something actually failed.
 */
export async function buildFailedAlert(failed: FailedNotif[]): Promise<string> {
  const userIds = [...new Set(failed.map((f) => f.userId))];
  const users = await dbClient.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, phoneNumber: true, grade: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const MAX_LISTED = 20;
  const lines = failed.slice(0, MAX_LISTED).map((f) => {
    const u = byId.get(f.userId);
    const who = u
      ? `${u.name}${u.phoneNumber ? ` (${u.phoneNumber})` : ''} [${u.grade}]`
      : `user ${f.userId}`;
    return `• *${who}* — ${f.type}\n  id: ${f.id} | retries: ${f.retryCount} | ${f.reason}`;
  });
  if (failed.length > MAX_LISTED) {
    lines.push(`…and ${failed.length - MAX_LISTED} more`);
  }

  return [
    ':x: *Push notifications permanently failed*',
    `Count: ${failed.length}`,
    '(retries exhausted or 24h retry window expired)',
    '',
    ...lines,
  ].join('\n');
}

export async function runNotificationRetryInner(): Promise<void> {
  const cfg = await dbClient.pushRetryConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...DEFAULT_CONFIG },
  });

  if (!cfg.enabled) return;

  const now = new Date();
  const windowCutoff = new Date(now.getTime() - RETRY_WINDOW_MS);

  // A read notification reached the user by definition — it's delivered, no
  // matter that FCM never accepted a token (web-only users have none). Close
  // these out as SENT so the retry loop and the failure alert never touch them.
  await dbClient.inAppNotification.updateMany({
    where: { deliveryStatus: 'PENDING', isRead: true },
    data: { deliveryStatus: 'SENT', nextRetryAt: null, lastError: null },
  });

  // Unread rows that aged out of the retry window would otherwise sit forever
  // claiming they'll be retried — they won't, so close them out and report who.
  // Rows for users with no FCM tokens (web-only) were never deliverable as a
  // push; they fail with a distinct reason and stay out of the Slack alert.
  const expiredRows = await dbClient.inAppNotification.findMany({
    where: {
      deliveryStatus: 'PENDING',
      isRead: false,
      createdAt: { lt: windowCutoff },
    },
    select: {
      id: true,
      user: { select: { fcmTokens: { select: { id: true }, take: 1 } } },
    },
  });
  const expiredIds = (hasTokens: boolean) =>
    expiredRows
      .filter((r) => r.user.fcmTokens.length > 0 === hasTokens)
      .map((r) => r.id);
  const alertableIds = expiredIds(true);
  await Promise.all(
    (
      [
        [alertableIds, 'retry window expired'],
        [expiredIds(false), 'no FCM tokens'],
      ] as const
    )
      .filter(([ids]) => ids.length > 0)
      .map(([ids, lastError]) =>
        dbClient.inAppNotification.updateMany({
          // Re-check status/isRead: a row can go SENT (inline delivery) or get
          // read between the snapshot above and this write — never stomp those.
          where: { id: { in: ids }, deliveryStatus: 'PENDING', isRead: false },
          data: { deliveryStatus: 'FAILED', lastError },
        }),
      ),
  );
  // Alert from what actually landed as FAILED, not the pre-write snapshot.
  // Only this job writes FAILED, so this can't pick up someone else's rows.
  const confirmedExpired =
    alertableIds.length > 0
      ? await dbClient.inAppNotification.findMany({
          where: { id: { in: alertableIds }, deliveryStatus: 'FAILED' },
          select: { id: true, userId: true, type: true, retryCount: true },
        })
      : [];

  const due = await dbClient.inAppNotification.findMany({
    where: {
      deliveryStatus: 'PENDING',
      isRead: false,
      retryCount: { lt: cfg.maxRetries },
      createdAt: { gte: windowCutoff },
      // Token-less users can't receive a push; their rows wait PENDING (a
      // token may appear within the window) and expire quietly above.
      user: { fcmTokens: { some: {} } },
      AND: [
        { OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
        // Only touch rows the inline path already finished with (it records
        // lastAttemptAt), or old enough that it clearly died before recording.
        {
          OR: [
            { lastAttemptAt: { not: null } },
            {
              createdAt: {
                lte: new Date(now.getTime() - INLINE_SEND_GRACE_MS),
              },
            },
          ],
        },
      ],
    },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  });

  let sent = 0;
  const exhaustedFailures: FailedNotif[] = [];

  if (due.length > 0) {
    // Retries are independent; fan out in parallel (same pattern as the order-service
    // notification sends). ponytail: FCM only — the batch process holds no live WS
    // connections, and FCM is the durable retry channel; WS fallback stays in the API path.
    const outcomes = await Promise.allSettled(
      due.map(async (n): Promise<'sent' | 'pending' | FailedNotif> => {
        const payload = createFCMNotificationPayload(n);
        const result: FCMSendResult = await sendFCMNotificationToUser(
          n.userId,
          payload,
        ).catch(() => ({
          success: false,
          tokensSent: 0,
          tokensFailed: 0,
          failedTokenIds: [],
        }));

        const attempt = n.retryCount + 1;

        if (result.tokensSent > 0) {
          // Retried write: if this lands nowhere the row stays PENDING and
          // the push the user just got would be re-sent every tick.
          await updateNotificationWithRetry(
            { id: n.id },
            {
              deliveryStatus: 'SENT',
              retryCount: attempt,
              lastAttemptAt: now,
              nextRetryAt: null,
              lastError: null,
            },
          );
          return 'sent';
        }

        const isExhausted = attempt >= cfg.maxRetries;
        let reason = 'FCM send error';
        if (result.noTokens) {
          reason = 'no FCM tokens';
        } else if (result.tokensFailed > 0) {
          reason = `${result.tokensFailed} token(s) failed`;
        }
        // This attempt started from a PENDING snapshot, but the inline
        // send path can race this same row and mark it SENT while this
        // FCM call was in flight. A failing retry must never stomp that
        // back to PENDING/FAILED — the not-SENT guard makes the write a
        // no-op instead of a downgrade in that case.
        await updateNotificationWithRetry(
          { id: n.id, deliveryStatus: { not: 'SENT' } },
          {
            deliveryStatus: isExhausted ? 'FAILED' : 'PENDING',
            retryCount: attempt,
            lastAttemptAt: now,
            nextRetryAt: isExhausted
              ? null
              : new Date(
                  now.getTime() + computeBackoffSec(n.retryCount, cfg) * 1000,
                ),
            lastError: reason,
          },
        );
        // Tokens deleted mid-flight: exhausted, but not a push failure
        // worth waking anyone up for — keep it out of the Slack alert.
        return isExhausted && !result.noTokens
          ? {
              id: n.id,
              userId: n.userId,
              type: n.type,
              retryCount: attempt,
              reason,
            }
          : 'pending';
      }),
    );

    outcomes.forEach((o) => {
      if (o.status !== 'fulfilled') {
        console.error('[NotificationRetry] retry attempt rejected:', o.reason);
      } else if (o.value === 'sent') {
        sent += 1;
      } else if (o.value !== 'pending') {
        exhaustedFailures.push(o.value);
      }
    });
  }

  const failed: FailedNotif[] = [
    ...exhaustedFailures,
    ...confirmedExpired.map((r) => ({
      id: r.id,
      userId: r.userId,
      type: r.type,
      retryCount: r.retryCount,
      reason: 'retry window expired',
    })),
  ];

  if (failed.length > 0) {
    const slack = getSlack('HEALTH_BOT_WEBHOOK');
    const message = await buildFailedAlert(failed);
    await slack
      ?.send(message)
      .catch((err) =>
        console.error('[NotificationRetry] Failed to send Slack alert:', err),
      );
  }

  if (due.length > 0 || failed.length > 0) {
    console.log(
      `[NotificationRetry] processed ${due.length} (sent ${sent}, newly-failed ${failed.length}).`,
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
