import { I18nManager, NativeModules } from 'react-native';

/**
 * The five locales the web app ships (see next.config.mjs). Kept in the same
 * order for easy diffing against it.
 */
export const SUPPORTED_LOCALES = ['en', 'ru', 'tk', 'ch', 'tr'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Matches the web's `defaultLocale`. The web sets `localeDetection: false`, so
 * Russian is what a browser falls back to and what the app must agree on.
 */
export const DEFAULT_LOCALE: SupportedLocale = 'ru';

/**
 * Device language subtag -> app locale.
 *
 * 'ch' is deliberately absent. It is a Chärjew dialect this app defines, not a
 * standardised language, so no operating system will ever report it -- and in
 * ISO 639-1 'ch' actually means Chamorro, so mapping it through would hand the
 * dialect bundle to the wrong person. It stays reachable only via a stored
 * NEXT_LOCALE the user chose in the web app's language switcher.
 */
const DEVICE_LANGUAGE_MAP: Record<string, SupportedLocale> = {
  en: 'en',
  ru: 'ru',
  tk: 'tk',
  tr: 'tr',
};

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Reduces a BCP-47-ish tag to one of our locales, or null if we don't ship it.
 * Android hands back `ru_RU` while Intl and iOS hand back `ru-RU`, so both
 * separators have to be tolerated.
 */
export function normalizeDeviceLocale(
  raw: string | null | undefined,
): SupportedLocale | null {
  if (!raw) {
    return null;
  }
  const language = raw.replace(/_/g, '-').split('-')[0].toLowerCase();
  return DEVICE_LANGUAGE_MAP[language] ?? null;
}

/**
 * Best-effort read of the OS language, without adding a native dependency.
 *
 * Three sources are tried because no single one covers both platforms:
 * Intl comes from Hermes and is the only genuinely cross-platform option;
 * `localeIdentifier` is Android-only (RCTI18nManager exports just isRTL and
 * doLeftAndRightSwapInRTL, so on iOS it is always undefined); AppleLanguages
 * reads iOS's NSUserDefaults through the Settings module. Each is wrapped
 * separately so one throwing still lets the next be tried.
 */
export function getDeviceLocale(): string | null {
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
      if (intlLocale) {
        return intlLocale;
      }
    }
  } catch {
    // Hermes can be built without Intl; fall through to the native modules.
  }

  try {
    const androidLocale = I18nManager.getConstants().localeIdentifier;
    if (androidLocale) {
      return androidLocale;
    }
  } catch {
    // Not Android, or the constant is missing.
  }

  try {
    const settings = NativeModules.SettingsManager?.settings;
    const appleLocale = settings?.AppleLocale ?? settings?.AppleLanguages?.[0];
    if (appleLocale) {
      return appleLocale;
    }
  } catch {
    // Not iOS, or NSUserDefaults had neither key.
  }

  return null;
}

/**
 * Picks the locale for the native screens.
 *
 * A stored NEXT_LOCALE always wins: it is an explicit choice the user made in
 * the web app's language switcher, and it is the only route to 'ch'. Detection
 * is a first-launch fallback only, and is deliberately not persisted -- writing
 * a guess into NEXT_LOCALE would make it indistinguishable from a real choice
 * and would freeze the app's language when the user changes their phone's.
 */
export function resolveLocale(
  stored: string | null | undefined,
  deviceLocale: string | null | undefined = getDeviceLocale(),
): SupportedLocale {
  if (isSupportedLocale(stored)) {
    return stored;
  }
  return normalizeDeviceLocale(deviceLocale) ?? DEFAULT_LOCALE;
}
