import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import ch from '@/i18n/ch.json';
import en from '@/i18n/en.json';
import ru from '@/i18n/ru.json';
import tk from '@/i18n/tk.json';
import tr from '@/i18n/tr.json';

const locales: Record<string, Record<string, string>> = { ru, tk, tr, ch };
const messages = en as Record<string, string>;

const isActivityKey = (key: string) =>
  key === 'adminActivity' || key.startsWith('activity');

const activityKeys = Object.keys(messages).filter(isActivityKey);

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });

describe('admin activity translations', () => {
  it('has the activity keys at all', () => {
    expect(activityKeys.length).toBeGreaterThan(50);
  });

  it.each(Object.keys(locales))(
    '%s has exactly the same activity keys as en',
    (locale) => {
      const keys = Object.keys(locales[locale]).filter(isActivityKey);
      expect(keys.sort()).toEqual([...activityKeys].sort());
    },
  );

  it.each(Object.keys(locales))(
    '%s keeps every placeholder of the en text',
    (locale) => {
      activityKeys.forEach((key) => {
        expect(placeholders(locales[locale][key]), `${locale}.${key}`).toEqual(
          placeholders(messages[key]),
        );
      });
    },
  );

  it('has no empty values', () => {
    [messages, ...Object.values(locales)].forEach((file) => {
      activityKeys.forEach((key) => {
        expect(file[key]?.trim().length, key).toBeGreaterThan(0);
      });
    });
  });

  it('defines every activity key the code refers to', () => {
    const root = path.resolve(__dirname, '../../../../src/pages');
    const files = [
      path.join(root, 'lib/adminActivity.ts'),
      ...sourceFiles(path.join(root, 'admin/activity')),
      path.join(root, 'user/index.page.tsx'),
    ];
    const used = new Set<string>();
    files.forEach((file) => {
      const source = fs.readFileSync(file, 'utf8');
      [
        ...source.matchAll(/['"`]((?:activity|adminActivity)\w*)['"`]/g),
      ].forEach((match) => used.add(match[1]));
    });
    expect(used.size).toBeGreaterThan(50);
    const missing = [...used].filter((key) => !(key in messages));
    expect(missing).toEqual([]);
  });
});
