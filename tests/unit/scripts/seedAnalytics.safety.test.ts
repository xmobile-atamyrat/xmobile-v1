import { describe, expect, it } from 'vitest';

import { USAGE } from '../../../scripts/analytics/args';
import {
  checkAppEnv,
  historyRefusals,
  MAX_FOREIGN_EVENTS,
  parseMarker,
  rangesOutside,
  SEED_MARKER_METRIC,
  seedRange,
  unionRanges,
} from '../../../scripts/analytics/safety';
import { STORED } from '../../../src/lib/analytics/metrics/stored';

describe('checkAppEnv', () => {
  it.each(['production', 'staging', ' Production '])('refuses %j', (env) => {
    expect(checkAppEnv(env)).toMatch(/deployed environment/);
  });

  // The values src/lib/ApiEndpoints.ts falls back to localhost for.
  it.each([undefined, '', 'development', 'local'])('allows %j', (env) => {
    expect(checkAppEnv(env)).toBeNull();
  });
});

describe('seedRange', () => {
  it('starts at the week or month start before the first day, whichever is earlier', () => {
    // 2026-07-31 is a Friday: its Monday (07-27) is after the 1st.
    expect(seedRange('2026-07-31', '2026-11-27')).toEqual({
      from: '2026-07-01',
      to: '2026-11-27',
    });
    // 2026-06-01 is a Monday and the 1st.
    expect(seedRange('2026-06-01', '2026-06-30')).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    });
    // 2026-09-02 is a Wednesday: the week started in August.
    expect(seedRange('2026-09-02', '2026-11-27').from).toBe('2026-08-31');
  });
});

describe('range helpers', () => {
  const r = (from: string, to: string) => ({ from, to });

  it('unions ranges, skipping missing ones', () => {
    expect(unionRanges()).toBeNull();
    expect(unionRanges(null, undefined)).toBeNull();
    expect(
      unionRanges(
        r('2026-03-01', '2026-03-10'),
        null,
        r('2026-02-20', '2026-03-05'),
      ),
    ).toEqual(r('2026-02-20', '2026-03-10'));
  });

  it('cuts a range around another', () => {
    const range = r('2026-03-01', '2026-03-31');
    expect(rangesOutside(range, r('2026-03-10', '2026-03-20'))).toEqual([
      r('2026-03-01', '2026-03-09'),
      r('2026-03-21', '2026-03-31'),
    ]);
    expect(rangesOutside(range, r('2026-02-01', '2026-03-15'))).toEqual([
      r('2026-03-16', '2026-03-31'),
    ]);
    expect(rangesOutside(range, r('2026-02-01', '2026-04-30'))).toEqual([]);
    expect(rangesOutside(range, r('2026-04-01', '2026-04-30'))).toEqual([
      range,
    ]);
  });
});

describe('parseMarker', () => {
  it('reads the marker rows, merging several', () => {
    expect(parseMarker([])).toBeNull();
    expect(
      parseMarker([
        { day: new Date('2026-07-01T00:00:00Z'), to: '2026-11-27' },
      ]),
    ).toEqual({ from: '2026-07-01', to: '2026-11-27' });
    expect(
      parseMarker([
        { day: '2026-07-01', to: '2026-08-01' },
        { day: new Date('2026-06-15T00:00:00Z'), to: '2026-07-20' },
      ]),
    ).toEqual({ from: '2026-06-15', to: '2026-08-01' });
  });

  it('ignores rows that are not a range', () => {
    expect(parseMarker([{ day: '2026-07-01', to: 'garbage' }])).toBeNull();
    expect(parseMarker([{ day: '2026-07-01', to: '2026-06-01' }])).toBeNull();
  });

  it('is not a metric the rollups or queries know', () => {
    expect(Object.values(STORED)).not.toContain(SEED_MARKER_METRIC);
  });
});

describe('historyRefusals', () => {
  it('allows a database with no foreign history', () => {
    expect(
      historyRefusals({ foreignRollupDays: [], foreignEvents: 0 }),
    ).toEqual([]);
    expect(
      historyRefusals({
        foreignRollupDays: [],
        foreignEvents: MAX_FOREIGN_EVENTS,
      }),
    ).toEqual([]);
  });

  it('refuses rollups no seed run recorded, naming them and --force', () => {
    const [one] = historyRefusals({
      foreignRollupDays: ['2026-05-01'],
      foreignEvents: 0,
    });
    expect(one).toMatch(/2026-05-01/);
    const [many] = historyRefusals({
      foreignRollupDays: ['2026-05-01', '2026-05-02', '2026-06-10'],
      foreignEvents: 0,
    });
    expect(many).toMatch(/3 days between 2026-05-01 and 2026-06-10/);
    expect(many).toMatch(/--force/);
  });

  it('refuses more than a handful of real raw events', () => {
    const reasons = historyRefusals({
      foreignRollupDays: ['2026-05-01'],
      foreignEvents: MAX_FOREIGN_EVENTS + 1,
    });
    expect(reasons).toHaveLength(2);
    expect(reasons[1]).toMatch(/real traffic/);
  });
});

describe('USAGE', () => {
  it('explains what the script refuses and what --clean touches', () => {
    expect(USAGE).toMatch(/NEXT_PUBLIC_APP_ENV is production or staging/);
    expect(USAGE).toMatch(/seed_marker/);
    expect(USAGE).toMatch(/--force/);
  });
});
