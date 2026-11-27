import type { Granularity, MetricUnit } from '@/lib/analytics/metrics/types';

/**
 * Number and label formatting for the analytics dashboard. `percent` values
 * are percentages (2.5 means 2.5 %), not fractions.
 */

// 'ch' (Çärjowça) is a Turkmen dialect; Intl would read it as Chamorro.
const INTL_LOCALES: Record<string, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  tk: 'tk-TM',
  tr: 'tr-TR',
  ch: 'tk-TM',
};

export const intlLocale = (locale: string | undefined): string =>
  INTL_LOCALES[locale ?? ''] ?? 'ru-RU';

export function formatNumber(
  value: number,
  locale: string | undefined,
  maximumFractionDigits = 0,
): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits,
  }).format(value);
}

/** A value in its widget's unit: `1 234`, `84 500 TMT`, `2.5%`. */
export function formatValue(
  value: number,
  unit: MetricUnit,
  locale: string | undefined,
): string {
  if (unit === 'tmt') return `${formatNumber(value, locale)} TMT`;
  if (unit === 'percent') return `${formatNumber(value, locale, 1)}%`;
  return formatNumber(value, locale);
}

export type Delta = {
  direction: 'up' | 'down' | 'flat';
  /** Signed, ready to show: `+12.5%`, `−3 pp` (pp filled in by the caller). */
  text: string;
  /** Percentage points (percent unit) rather than a relative change. */
  points: boolean;
};

const signed = (text: string, value: number): string => {
  if (value > 0) return `+${text}`;
  if (value < 0) return `−${text}`;
  return text;
};

/**
 * Change against the previous period. Percent metrics change in percentage
 * points; the rest relative to the previous value. With no previous value
 * (or a previous of 0, where a ratio means nothing) there's either no delta
 * or the absolute change.
 */
export function kpiDelta(
  value: number,
  previous: number | null,
  unit: MetricUnit,
  locale: string | undefined,
): Delta | null {
  if (previous == null || !Number.isFinite(previous)) return null;
  const diff = value - previous;
  const direction: Delta['direction'] =
    // eslint-disable-next-line no-nested-ternary
    diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  if (unit === 'percent') {
    return {
      direction,
      text: signed(formatNumber(Math.abs(diff), locale, 1), diff),
      points: true,
    };
  }
  if (previous === 0) {
    return {
      direction,
      text: signed(formatValue(Math.abs(diff), unit, locale), diff),
      points: false,
    };
  }
  const change = (diff / Math.abs(previous)) * 100;
  return {
    direction,
    text: `${signed(formatNumber(Math.abs(change), locale, 1), change)}%`,
    points: false,
  };
}

/** `value / of` as a percent string, or null when `of` is 0. */
export function formatShare(
  value: number,
  of: number,
  locale: string | undefined,
): string | null {
  if (of <= 0) return null;
  return `${formatNumber((value / of) * 100, locale, 1)}%`;
}

/** Axis label for a period start day. */
export function formatPeriod(period: string, granularity: Granularity): string {
  const [year, month, day] = period.split('-');
  if (granularity === 'month') return `${month}.${year}`;
  return `${day}.${month}`;
}

/**
 * Start of the chart period (day, ISO week from Monday, or month) that
 * contains `day`, as 'YYYY-MM-DD'. Pure, so the dashboard can mark the
 * period that includes today as still in progress.
 */
export function periodContaining(
  day: string,
  granularity: Granularity,
): string {
  if (granularity === 'month') return `${day.slice(0, 7)}-01`;
  if (granularity === 'week') {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
  }
  return day;
}

/** Full date for tooltips: dd.mm.yyyy. */
export function formatDay(day: string): string {
  const [year, month, date] = day.split('-');
  return `${date}.${month}.${year}`;
}

/**
 * Translation keys for the values of breakdown widgets, by widget id. Other
 * widgets show their row labels as they are (a search query "ru" stays "ru").
 */
export const BREAKDOWN_LABEL_KEYS: Record<string, Record<string, string>> = {
  by_platform: { WEB: 'analyticsPlatformWeb', APP: 'analyticsPlatformApp' },
  by_locale: {
    ru: 'analyticsLocaleRu',
    en: 'analyticsLocaleEn',
    tk: 'analyticsLocaleTk',
    tr: 'analyticsLocaleTr',
    ch: 'analyticsLocaleCh',
  },
  by_device: {
    mobile: 'analyticsDeviceMobile',
    tablet: 'analyticsDeviceTablet',
    desktop: 'analyticsDeviceDesktop',
    unknown: 'analyticsUnknown',
  },
  top_referrers: { '': 'analyticsReferrerDirect' },
};
