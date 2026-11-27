import { describe, expect, it } from 'vitest';

import {
  checkDatabaseUrl,
  DEFAULT_ARGS,
  parseArgs,
} from '../../../scripts/analytics/args';

describe('parseArgs', () => {
  it('uses the defaults', () => {
    expect(parseArgs([])).toEqual(DEFAULT_ARGS);
    expect(DEFAULT_ARGS.days).toBe(120);
    expect(DEFAULT_ARGS.orders).toBe(true);
  });

  it('reads every option, with spaces or =', () => {
    expect(
      parseArgs([
        '--days',
        '30',
        '--visitors-per-day=250',
        '--seed',
        '9',
        '--no-orders',
        '--clean',
        '--force',
      ]),
    ).toEqual({
      ...DEFAULT_ARGS,
      days: 30,
      visitorsPerDay: 250,
      seed: 9,
      orders: false,
      clean: true,
      force: true,
    });
  });

  it('rejects bad values and unknown flags', () => {
    expect(() => parseArgs(['--days'])).toThrow(/--days/);
    expect(() => parseArgs(['--days', '0'])).toThrow(/--days/);
    expect(() => parseArgs(['--days', '1.5'])).toThrow(/--days/);
    expect(() => parseArgs(['--visitors-per-day', 'lots'])).toThrow();
    expect(() => parseArgs(['--prod'])).toThrow(/Unknown option/);
  });
});

describe('checkDatabaseUrl', () => {
  it.each([
    'postgresql://u:p@localhost:5432/ecom',
    'postgresql://u:p@127.0.0.1:5432/ecom?schema=public',
    'postgresql://u:p@[::1]:5432/ecom',
    'postgresql://u:p@host.docker.internal:5432/ecom',
    'postgresql://u:p@postgres:5432/ecom',
    'postgresql://u:p@db/ecom',
  ])('accepts %s', (url) => {
    expect(checkDatabaseUrl(url).ok).toBe(true);
  });

  it.each([
    'postgresql://u:p@10.0.0.5:5432/ecom',
    'postgresql://u:p@xmobile.tm:5432/ecom',
    'postgresql://u:p@db.example.com/ecom',
    'postgresql://u:p@localhost.evil.com/ecom',
  ])('refuses %s and says why', (url) => {
    const check = checkDatabaseUrl(url);
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/--force/);
  });

  it('refuses a missing or broken URL', () => {
    expect(checkDatabaseUrl(undefined).ok).toBe(false);
    expect(checkDatabaseUrl('not a url').ok).toBe(false);
  });
});
