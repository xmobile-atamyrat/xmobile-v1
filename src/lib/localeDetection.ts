import { DEFAULT_LOCALE, POST_SOVIET_COUNTRIES } from '@/pages/lib/constants';
import { STATIC_PATH_LOCALES } from '@/pages/lib/ssgLocales';

/*
 * Which language a page is served in, highest priority first:
 *
 *   1. NEXT_LOCALE cookie -- the user's own pick in the switcher.
 *   2. The browser's / phone's language (Accept-Language), even over a link
 *      in another language.
 *   3. The link's language (`/en/...`, `/tk/...`).
 *   4. GeoIP, on the home page only (see index.page.tsx).
 *   5. ru.
 *
 * Steps 1-3 run in production nginx (scripts/prod_scripts/nginx-locale-*),
 * before a request
 * reaches Next. The rules here must read Accept-Language and user agents the
 * same way, or the home page would guess GeoIP for a visitor nginx already
 * placed, or skip it for one nginx left alone.
 */

export type Locale = (typeof STATIC_PATH_LOCALES)[number];

export const isSupportedLocale = (value: unknown): value is Locale =>
  typeof value === 'string' &&
  (STATIC_PATH_LOCALES as readonly string[]).includes(value);

/**
 * Browser language -> our locale. 'ch' is a Chärjew dialect no browser or
 * phone reports (and ISO 'ch' is Chamorro), so it is never detected -- only
 * picked. Same map as the mobile app's `mobile/src/i18n/locale.ts`.
 */
const BROWSER_LANGUAGE_MAP: Record<string, Locale> = {
  en: 'en',
  ru: 'ru',
  tk: 'tk',
  tr: 'tr',
};

/**
 * The browser's main language, if we ship it: the first entry, as nginx reads
 * it. Only that one counts, like the app's device language: Chrome appends
 * `en` to most lists, so reading further down would answer "English" for
 * nearly everyone. Browsers list the main language first, so q is ignored.
 */
export const localeFromAcceptLanguage = (
  header: string | null | undefined,
): Locale | null => {
  const tag = header?.split(/[,;]/)[0].trim() ?? '';
  const language = tag.replace(/_/g, '-').split('-')[0].toLowerCase();
  return BROWSER_LANGUAGE_MAP[language] ?? null;
};

/** GeoIP country -> locale; the rule the home page has always used. */
export const localeFromCountry = (country: string): Locale => {
  if (country === 'TR') return 'tr';
  if (POST_SOVIET_COUNTRIES.includes(country)) return 'ru';
  return 'en';
};

/**
 * Search engines and link-preview fetchers get the page the URL names, never a
 * guess: redirecting them would hide whole languages from search results and
 * show a preview in a language the link didn't ask for.
 *
 * `(?<!cu)` spares CUBOT phones ("CUBOT X30"). A request with no user agent at
 * all is a script or monitor, so it is left alone too. nginx has the same list
 * (`$lc_bot`); change both together.
 */
const CRAWLER_PATTERN =
  /(?<!cu)bot\b|crawl|spider|slurp|mediapartners|google-inspectiontool|googleother|apis-google|facebookexternalhit|facebookcatalog|whatsapp|skypeuripreview|vkshare|yandex|bingpreview|embedly|quora link preview|pinterest|lighthouse|pagespeed/i;

export const isCrawler = (userAgent: string | null | undefined): boolean =>
  !userAgent || CRAWLER_PATTERN.test(userAgent);

/** `/product?x=1` in `locale`, without a prefix for the default one. */
export const localizedPath = (locale: Locale, pathAndQuery: string): string => {
  if (locale === DEFAULT_LOCALE) return pathAndQuery;
  // Home is `/en`, not `/en/`: Next would redirect the trailing slash away.
  const rest = pathAndQuery.replace(/^\/(?=\?|#|$)/, '');
  return `/${locale}${rest}`;
};
