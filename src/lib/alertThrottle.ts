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
 * suppressed alert is never a silently lost one.
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

export function createAlertThrottle(
  options: AlertThrottleOptions,
): AlertThrottle {
  const { windowMs, maxPerWindow, maxKeys } = options;

  const seen = new Map<string, number>();
  let windowStartMs = Number.NEGATIVE_INFINITY;
  let sentInWindow = 0;
  let suppressedInWindow = 0;

  function rollWindow(nowMs: number): string[] {
    if (nowMs - windowStartMs < windowMs) return [];

    const summary =
      suppressedInWindow > 0
        ? [
            `:mute: ${suppressedInWindow} duplicate/excess alert(s) suppressed in the last ${Math.round(
              windowMs / 60_000,
            )}m.`,
          ]
        : [];

    seen.clear();
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
        suppressedInWindow += 1;
        return pending;
      }

      // Dropping the whole map is crude, but an unbounded key set on a
      // long-lived process is worse, and the rate cap still holds the line.
      if (seen.size >= maxKeys) seen.clear();
      seen.set(message, 1);

      if (sentInWindow >= maxPerWindow) {
        suppressedInWindow += 1;
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
