import { describe, expect, it, vi } from 'vitest';

import { parseTmtMinor } from '@/lib/analytics/metrics/revenue';

vi.mock('@/lib/dbClient', () => ({ default: {} }));

describe('parseTmtMinor', () => {
  it('stores whole and fractional manat as hundredths', () => {
    expect(parseTmtMinor('1290')).toBe(129_000);
    expect(parseTmtMinor('1305.50')).toBe(130_550);
    expect(parseTmtMinor('99.99')).toBe(9_999);
    expect(parseTmtMinor('0.01')).toBe(1);
  });

  it('rounds sub-tenge noise instead of truncating', () => {
    // 0.1 + 0.2 style float error from toFixed-less arithmetic.
    expect(parseTmtMinor('1283.0000000001')).toBe(128_300);
    expect(parseTmtMinor('19.995')).toBe(2_000);
  });

  it('parses like parseFloat does in orderService', () => {
    expect(parseTmtMinor(' 150 ')).toBe(15_000);
    expect(parseTmtMinor('150 TMT')).toBe(15_000);
    expect(parseTmtMinor('1e3')).toBe(100_000);
  });

  it('counts bad values as 0', () => {
    expect(parseTmtMinor('')).toBe(0);
    expect(parseTmtMinor('abc')).toBe(0);
    expect(parseTmtMinor('NaN')).toBe(0);
    expect(parseTmtMinor('Infinity')).toBe(0);
    expect(parseTmtMinor('-50')).toBe(0);
    expect(parseTmtMinor(null)).toBe(0);
    expect(parseTmtMinor(undefined)).toBe(0);
  });
});
