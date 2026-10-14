/**
 * Collapses repeated Slack alerts.
 *
 * Every `console.error` is mirrored to Slack (see logger.ts), so a single
 * upstream outage used to arrive as hundreds of near-identical alerts: the FCM
 * send path fans out per token, and the batch retry job re-attempts the same
 * notification 3 more times, each attempt re-logging the same line.
 *
 * Two independent guards:
 *  - **dedup** — an identical message is sent once per window. Because the FCM
 *    failure line embeds the notification id, this is effectively "one alert per
 *    notification", no matter how many retry attempts it goes through.
 *  - **rate cap** — a hard ceiling on alerts per window, for the case dedup
 *    can't help with: one retry tick failing 100 *different* notifications.
 *
 * Whatever gets swallowed is reported as a count when the window rolls, so a
 * suppressed alert is never a silently lost one. There is no timer: the summary
 * rides along with the next alert, which may come hours later, so it says when
 * its window ended and which alert was repeated most rather than implying it
 * covers the minutes just before it.
 */

export interface AlertThrottleOptions {
  windowMs: number;
  maxPerWindow: number;
  /** Bounds memory if the process is flooded with unique messages. */
  maxKeys: number;
}

export interface AlertThrottle {
  /**
   * Returns the messages to actually send: the incoming one if it is admitted,
   * optionally preceded by a summary of what the previous window swallowed.
   */
  admit(message: string, nowMs: number): string[];
  size(): number;
}

const PREVIEW_MAX_CHARS = 150;

/** First line of an alert, without the icon/level prefix, kept short. */
function preview(message: string): string {
  const firstLine = message
    .split('\n')[0]
    .replace(/^:\w+: \*\[\w+\]\* /, '')
    .trim();
  return firstLine.length > PREVIEW_MAX_CHARS
    ? `${firstLine.slice(0, PREVIEW_MAX_CHARS)}…`
    : firstLine;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function createAlertThrottle(
  options: AlertThrottleOptions,
): AlertThrottle {
  const { windowMs, maxPerWindow, maxKeys } = options;

  const seen = new Map<string, number>();
  let windowStartMs = Number.NEGATIVE_INFINITY;
  let sentInWindow = 0;
  let suppressedInWindow = 0;
  // Per-message suppressed counts, to name the noisiest alert in the summary.
  const suppressedBy = new Map<string, number>();

  function recordSuppressed(message: string) {
    suppressedInWindow += 1;
    if (!suppressedBy.has(message) && suppressedBy.size >= maxKeys) return;
    suppressedBy.set(message, (suppressedBy.get(message) ?? 0) + 1);
  }

  function summarize(nowMs: number): string {
    const windowMinutes = Math.round(windowMs / 60_000);
    const endedAgoMs = nowMs - (windowStartMs + windowMs);
    const when =
      endedAgoMs < 60_000
        ? 'that just ended'
        : `that ended ${formatDuration(endedAgoMs)} ago`;

    let top: [string, number] | undefined;
    suppressedBy.forEach((count, message) => {
      if (!top || count > top[1]) top = [message, count];
    });
    const topLine = top
      ? ` Most repeated (${top[1]}x): ${preview(top[0])}`
      : '';

    return `:warning: *[WARN]* ${suppressedInWindow} duplicate/excess alert(s) suppressed in the ${windowMinutes}m window ${when}.${topLine}`;
  }

  function rollWindow(nowMs: number): string[] {
    if (nowMs - windowStartMs < windowMs) return [];

    const summary = suppressedInWindow > 0 ? [summarize(nowMs)] : [];

    seen.clear();
    suppressedBy.clear();
    windowStartMs = nowMs;
    sentInWindow = 0;
    suppressedInWindow = 0;
    return summary;
  }

  return {
    admit(message: string, nowMs: number): string[] {
      const pending = rollWindow(nowMs);

      const count = seen.get(message);
      if (count !== undefined) {
        seen.set(message, count + 1);
        recordSuppressed(message);
        return pending;
      }

      // Dropping the whole map is crude, but an unbounded key set on a
      // long-lived process is worse, and the rate cap still holds the line.
      if (seen.size >= maxKeys) seen.clear();
      seen.set(message, 1);

      if (sentInWindow >= maxPerWindow) {
        recordSuppressed(message);
        return pending;
      }

      sentInWindow += 1;
      return [...pending, message];
    },

    size() {
      return seen.size;
    },
  };
}
