import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import ch from '@/i18n/ch.json';
import en from '@/i18n/en.json';
import ru from '@/i18n/ru.json';
import tk from '@/i18n/tk.json';
import tr from '@/i18n/tr.json';
import {
  SERIES_LABEL_KEYS,
  WIDGET_HINT_KEYS,
  WIDGETS,
} from '@/lib/analytics/metrics/catalog';
import { BREAKDOWN_LABEL_KEYS } from '@/pages/admin/analytics/format';

const locales: Record<string, Record<string, string>> = {
  ru,
  en,
  tk,
  tr,
  ch,
};

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

const dashboardDir = path.resolve(
  __dirname,
  '../../../../src/pages/admin/analytics',
);

/** Every analytics* key the dashboard source refers to literally. */
const usedKeys = (): string[] => {
  const keys = new Set<string>();
  fs.readdirSync(dashboardDir)
    .filter((name) => /\.tsx?$/.test(name))
    .forEach((name) => {
      const source = fs.readFileSync(path.join(dashboardDir, name), 'utf8');
      [...source.matchAll(/['"`](analytics[A-Z]\w*)['"`]/g)].forEach((m) =>
        keys.add(m[1]),
      );
    });
  return [...keys];
};

const requiredKeys = [
  ...WIDGETS.map((widget) => widget.labelKey),
  ...Object.values(SERIES_LABEL_KEYS),
  ...Object.values(WIDGET_HINT_KEYS),
  ...Object.values(BREAKDOWN_LABEL_KEYS).flatMap((map) => Object.values(map)),
  ...usedKeys(),
  // Reused from the old /analytics page.
  'analytics',
  'totalUserCount',
  'telekomBalance',
];

const analyticsKeys = Object.keys(en).filter((key) =>
  key.startsWith('analytics'),
);

describe('analytics dashboard translations', () => {
  it('finds the keys the dashboard uses', () => {
    expect(usedKeys().length).toBeGreaterThan(20);
  });

  it.each(Object.keys(locales))(
    '%s has every widget, series and dashboard key',
    (locale) => {
      const file = locales[locale];
      const missing = requiredKeys.filter(
        (key) => typeof file[key] !== 'string' || file[key].trim() === '',
      );
      expect(missing).toEqual([]);
    },
  );

  it.each(['ru', 'tk', 'tr', 'ch'])(
    '%s has the same analytics keys and placeholders as en',
    (locale) => {
      const file = locales[locale];
      expect(
        Object.keys(file)
          .filter((key) => key.startsWith('analytics'))
          .sort(),
      ).toEqual([...analyticsKeys].sort());
      analyticsKeys.forEach((key) => {
        expect(placeholders(file[key]), `${locale}.${key}`).toEqual(
          placeholders(en[key as keyof typeof en] as string),
        );
      });
    },
  );
});
