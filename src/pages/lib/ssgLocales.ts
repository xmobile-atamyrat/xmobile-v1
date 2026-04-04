import type { GetStaticPathsContext } from 'next';

/** Fallback if `context.locales` is empty (keep in sync with `next.config` `i18n.locales`). */
const STATIC_PATH_LOCALES = ['en', 'ru', 'tk', 'ch', 'tr'] as const;

/**
 * One `{ params: { id }, locale }` per id × locale so SSG runs for every locale at build time.
 */
export function expandDynamicPathsForAllLocales(
  context: GetStaticPathsContext,
  ids: string[],
): { params: { id: string }; locale: string }[] {
  const locales =
    context.locales && context.locales.length > 0
      ? context.locales
      : [...STATIC_PATH_LOCALES];
  return ids.flatMap((id) =>
    locales.map((locale) => ({ params: { id }, locale })),
  );
}
