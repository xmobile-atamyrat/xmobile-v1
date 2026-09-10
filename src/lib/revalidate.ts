import { STATIC_PATH_LOCALES } from '@/pages/lib/ssgLocales';
import type { NextApiResponse } from 'next';

/**
 * On-demand ISR revalidation for the three statically generated catalog routes:
 * `/product/[slug]`, `/category/[slug]` and `/product-category/[categorySlug]`.
 *
 * Self-hosted (`next start`) `res.revalidate()` is an in-process render — Next
 * only falls back to an HTTP round-trip when `trustHostHeader` is set, which is
 * Vercel-only. So no origin configuration is needed, but each call still re-runs
 * `getStaticProps`, which fetches back into this same server. That is why the
 * batch is bounded rather than unlimited.
 */

/**
 * Above this, the batch is dropped instead of truncated: a half-applied refresh
 * is harder to reason about than none at all, and the 600s TTL still covers it.
 * Doubles as the guard that keeps bulk price edits from queueing thousands of
 * regenerations behind a single admin save.
 */
export const MAX_PATHS_PER_BATCH = 250;

/** Enough to keep the render loop busy without starving ordinary requests. */
const CONCURRENCY = 4;

/**
 * Only the `revalidate` half of `NextApiResponse` is used, so handlers can pass
 * their `res` straight through and tests can pass a stub.
 */
type Revalidatable = Pick<NextApiResponse, 'revalidate'>;

/**
 * One path per locale. The ISR cache key includes the locale, so an unprefixed
 * path would only ever refresh the default locale's entry.
 */
export function localePaths(route: string): string[] {
  return STATIC_PATH_LOCALES.map((locale) => `/${locale}/${route}`);
}

/** Empty for a missing slug — better than queueing `/en/product/undefined`. */
function pathsForRoute(
  prefix: string,
  slug: string | null | undefined,
): string[] {
  if (slug == null || slug === '') return [];
  return localePaths(`${prefix}/${slug}`);
}

export function productPaths(slug: string | null | undefined): string[] {
  return pathsForRoute('product', slug);
}

export function categoryPaths(slug: string | null | undefined): string[] {
  return pathsForRoute('category', slug);
}

export function productCategoryPaths(
  slug: string | null | undefined,
): string[] {
  return pathsForRoute('product-category', slug);
}

/**
 * Rebuilds every given path, deduped and bounded. Never rejects: a page that
 * failed to refresh is stale, not broken, and must not turn a successful admin
 * save into a 500.
 */
export async function revalidatePaths(
  res: Revalidatable,
  paths: string[],
): Promise<void> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return;

  if (unique.length > MAX_PATHS_PER_BATCH) {
    console.warn(
      `revalidatePaths: skipping batch of ${unique.length} paths (cap ${MAX_PATHS_PER_BATCH}); those pages will refresh on their own TTL`,
    );
    return;
  }

  // Lanes claim the next index rather than taking a fixed slice, so one slow
  // page doesn't leave a lane idle while others still have work.
  let next = 0;
  const worker = async () => {
    while (next < unique.length) {
      const path = unique[next];
      next += 1;
      try {
        // `unstable_onlyGenerated` keeps this to pages that are already cached:
        // a page nobody has visited stays lazily generated, and the 404 a
        // just-deleted product now renders stops being reported as a failure.
        // eslint-disable-next-line no-await-in-loop
        await res.revalidate(path, { unstable_onlyGenerated: true });
      } catch (error) {
        // Warn, not error — src/lib/logger forwards ERROR to Slack, and a stale
        // page is not worth paging anyone over.
        console.warn(
          `revalidatePaths: ${path} failed to revalidate:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker),
  );
}

/**
 * Fire-and-forget wrapper for API handlers: returns immediately so the admin's
 * save is never held up by — or failed by — a regeneration.
 */
export function revalidateInBackground(
  res: Revalidatable,
  paths: string[],
): void {
  revalidatePaths(res, paths).catch((error) => {
    console.warn('revalidateInBackground: batch failed:', error);
  });
}
