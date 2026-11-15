import { RefObject, useEffect, useState } from 'react';

const SPEED_PX_PER_S = 30;
// After a swipe or tap the strip stays where the user left it for a moment.
const RESUME_AFTER_MS = 3000;
// Gap between a scroll position we wrote and the one read back that still
// counts as ours (browsers round scrollLeft to device pixels).
const OWN_SCROLL_SLACK_PX = 2;

/**
 * Turns an `overflow-x-auto` row holding its items twice (`copyRef` is the
 * first copy) into an endless marquee: it drifts left while `running`, wraps
 * seamlessly in both directions, and yields to the user's own scrolling.
 *
 * Returns the width of one copy once the items overflow the row, else 0; the
 * caller renders the second copy only when it is non-zero.
 */
export function useMarqueeScroll(
  rowRef: RefObject<HTMLElement>,
  copyRef: RefObject<HTMLElement>,
  running: boolean,
): number {
  const [loopWidth, setLoopWidth] = useState(0);
  const [visible, setVisible] = useState(true);
  // Mutable state shared by the listeners and the animation frame.
  const [shared] = useState(() => ({
    pausedUntil: 0,
    touching: false,
    // Last scrollLeft this hook wrote; anything else is the user's doing.
    ours: 0,
  }));

  useEffect(() => {
    const row = rowRef.current;
    const copy = copyRef.current;
    if (!row || !copy) return undefined;
    // One copy wider than the row means the second copy fills the view while
    // the first scrolls out, so the wrap below is invisible.
    const measure = () =>
      setLoopWidth(copy.offsetWidth > row.clientWidth ? copy.offsetWidth : 0);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [rowRef, copyRef]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    observer.observe(row);
    return () => observer.disconnect();
  }, [rowRef]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || !loopWidth) return undefined;
    // The copies start after the row's padding; scrolling one copy width from
    // there shows the second copy exactly where the first was.
    const start = parseFloat(getComputedStyle(row).paddingLeft) || 0;
    const hold = () => {
      shared.pausedUntil = performance.now() + RESUME_AFTER_MS;
    };
    const onTouchStart = () => {
      shared.touching = true;
      hold();
    };
    const onTouchEnd = () => {
      shared.touching = false;
      hold();
    };
    const onScroll = () => {
      // Covers momentum after a fling, which outlasts touchend.
      if (Math.abs(row.scrollLeft - shared.ours) > OWN_SCROLL_SLACK_PX) hold();
      const userActive =
        shared.touching || performance.now() < shared.pausedUntil;
      if (row.scrollLeft >= start + loopWidth) {
        row.scrollLeft -= loopWidth;
        shared.ours = row.scrollLeft;
      } else if (userActive && row.scrollLeft < start) {
        row.scrollLeft += loopWidth;
        shared.ours = row.scrollLeft;
      }
    };
    const listeners: [string, () => void][] = [
      ['touchstart', onTouchStart],
      ['touchend', onTouchEnd],
      ['touchcancel', onTouchEnd],
      ['pointerdown', hold],
      ['wheel', hold],
      ['focusin', hold],
      ['scroll', onScroll],
    ];
    listeners.forEach(([type, fn]) =>
      row.addEventListener(type, fn, { passive: true }),
    );
    return () =>
      listeners.forEach(([type, fn]) => row.removeEventListener(type, fn));
  }, [rowRef, loopWidth, shared]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || !loopWidth || !running || !visible) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const start = parseFloat(getComputedStyle(row).paddingLeft) || 0;
    // A float of our own: scrollLeft rounds, so adding sub-pixel steps to it
    // directly would stall.
    let pos = row.scrollLeft;
    let last: number | null = null;
    let frame = 0;
    const tick = (now: number) => {
      const dt = last === null ? 0 : now - last;
      last = now;
      if (shared.touching || now < shared.pausedUntil) {
        pos = row.scrollLeft;
      } else {
        pos += (SPEED_PX_PER_S * dt) / 1000;
        // Wrapped here, not left to the scroll listener: scroll events land a
        // frame late and the next write would undo the listener's wrap.
        if (pos >= start + loopWidth) pos -= loopWidth;
        row.scrollLeft = pos;
        shared.ours = row.scrollLeft;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rowRef, loopWidth, running, visible, shared]);

  return loopWidth;
}
