import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  analyticsRetentionJob,
  runAnalyticsRetention,
} from '../../../scripts/batch-runner/jobs/analytics-retention';
import {
  analyticsRollupJob,
  daysToRollup,
  runAnalyticsRollup,
} from '../../../scripts/batch-runner/jobs/analytics-rollup';
import {
  analyticsRollupNightlyJob,
  runAnalyticsRollupNightly,
} from '../../../scripts/batch-runner/jobs/analytics-rollup-nightly';
import { jobs } from '../../../scripts/batch-runner/jobs/registry';

const { rollupDay, rollupPeriodUniques, refreshOrderOutcomes, prune } =
  vi.hoisted(() => ({
    rollupDay: vi.fn(),
    rollupPeriodUniques: vi.fn(),
    refreshOrderOutcomes: vi.fn(),
    prune: vi.fn(),
  }));

vi.mock('../../../src/lib/analytics/rollup', () => ({
  rollupDay,
  rollupPeriodUniques,
  refreshOrderOutcomes,
}));
vi.mock('../../../src/lib/analytics/retention', () => ({
  pruneAnalyticsEvents: prune,
}));
vi.mock('../../../src/lib/dbClient', () => ({ default: {} }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('analytics-rollup', () => {
  it('recomputes only today after the first hour', () => {
    // 01:00 Ashgabat on 2026-11-27.
    expect(daysToRollup(new Date('2026-11-26T20:00:00Z'))).toEqual([
      '2026-11-27',
    ]);
    // 18:59 UTC is 23:59 local.
    expect(daysToRollup(new Date('2026-11-27T18:59:00Z'))).toEqual([
      '2026-11-27',
    ]);
  });

  it('also recomputes yesterday during the first hour after midnight', () => {
    expect(daysToRollup(new Date('2026-11-26T19:00:00Z'))).toEqual([
      '2026-11-26',
      '2026-11-27',
    ]);
    expect(daysToRollup(new Date('2026-11-26T19:59:59Z'))).toEqual([
      '2026-11-26',
      '2026-11-27',
    ]);
    // New Year in Ashgabat.
    expect(daysToRollup(new Date('2026-12-31T19:10:00Z'))).toEqual([
      '2026-12-31',
      '2027-01-01',
    ]);
  });

  it('runs rollupDay per day with the same clock', async () => {
    const now = new Date('2026-11-26T19:30:00Z');
    expect(await runAnalyticsRollup(now)).toEqual(['2026-11-26', '2026-11-27']);
    expect(rollupDay.mock.calls).toEqual([
      ['2026-11-26', { now }],
      ['2026-11-27', { now }],
    ]);
  });

  it('runs every 10 minutes', () => {
    expect(analyticsRollupJob.schedule).toEqual({
      type: 'interval',
      ms: 600_000,
    });
  });
});

describe('analytics-rollup-nightly', () => {
  it('finalizes yesterday, its periods and refreshes order outcomes', async () => {
    // 01:30 Ashgabat on 2026-11-27.
    const now = new Date('2026-11-26T20:30:00Z');
    expect(await runAnalyticsRollupNightly(now)).toEqual({
      yesterday: '2026-11-26',
      refreshedFrom: '2026-08-30',
      refreshedTo: '2026-11-25',
    });
    expect(rollupDay).toHaveBeenCalledWith('2026-11-26', { now });
    expect(rollupPeriodUniques).toHaveBeenCalledWith('2026-11-26', { now });
    expect(refreshOrderOutcomes).toHaveBeenCalledWith(
      '2026-08-30',
      '2026-11-25',
      { now },
    );
  });

  it('runs at 01:30 Ashgabat time, not the VM time zone', () => {
    expect(analyticsRollupNightlyJob.schedule).toEqual({
      type: 'cron',
      expr: '30 1 * * *',
      timezone: 'Asia/Ashgabat',
    });
  });
});

describe('analytics-retention', () => {
  it('prunes with the given clock', async () => {
    prune.mockResolvedValueOnce({ deleted: 5, batches: 1 });
    const now = new Date('2026-11-27T00:00:00Z');
    expect(await runAnalyticsRetention(now)).toEqual({
      deleted: 5,
      batches: 1,
    });
    expect(prune).toHaveBeenCalledWith({ now });
  });

  it('runs nightly in Ashgabat time', () => {
    expect(analyticsRetentionJob.schedule).toEqual({
      type: 'cron',
      expr: '30 4 * * *',
      timezone: 'Asia/Ashgabat',
    });
  });
});

describe('registry', () => {
  it('registers the three analytics jobs once each', () => {
    const ids = jobs.map((j) => j.id);
    [
      'analytics-rollup',
      'analytics-rollup-nightly',
      'analytics-retention',
    ].forEach((id) => expect(ids.filter((x) => x === id)).toHaveLength(1));
  });
});
