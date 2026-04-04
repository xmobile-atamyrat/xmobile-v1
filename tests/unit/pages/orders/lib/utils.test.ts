import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatDate } from '@/pages/orders/lib/utils';

describe('formatDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns dash for nullish dates', () => {
    expect(formatDate(null, 'web')).toBe('-');
    expect(formatDate(undefined, 'mobile')).toBe('-');
  });

  it('formats for mobile with en-GB style (day/month/year)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-05T15:00:00.000Z'));
    const s = formatDate(new Date('2024-03-05T15:00:00.000Z'), 'mobile');
    expect(s).toMatch(/05/);
    expect(s).toMatch(/03/);
    expect(s).toMatch(/2024/);
  });

  it('formats for web with en-US style (includes month name)', () => {
    const s = formatDate(new Date('2024-06-12T10:00:00.000Z'), 'web');
    expect(s).toMatch(/Jun/);
    expect(s).toMatch(/12/);
    expect(s).toMatch(/2024/);
  });

  it('accepts ISO string input', () => {
    const s = formatDate('2022-01-01T00:00:00.000Z', 'web');
    expect(s).not.toBe('-');
    expect(s.length).toBeGreaterThan(4);
  });
});
