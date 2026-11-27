import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  analyticsRetentionJob,
  runAnalyticsRetention,
} from '../../../scripts/batch-runner/jobs/analytics-retention';
import {
  analyticsRollupJob,
  createAnalyticsRollupJob,
  daysToRollup,
  runAnalyticsRollup,
} from '../../../scripts/batch-runner/jobs/analytics-rollup';
import {
  analyticsRollupNightlyJob,
  runAnalyticsRollupNightly,
} from '../../../scripts/batch-runner/jobs/analytics-rollup-nightly';
import { jobs } from '../../../scripts/batch-runner/jobs/registry';

const { rollupDay, catchUp, refreshFunnel, prune } = vi.hoisted(() => ({
  rollupDay: vi.fn(),
  catchUp: vi.fn(),
  refreshFunnel: vi.fn(),
  prune: vi.fn(),
}));

vi.mock('../../../src/lib/analytics/rollup', () => ({
  rollupDay,
  catchUp,
  refreshFunnel,
}));
vi.mock('../../../src/lib/analytics/retention', () => ({
  pruneAnalyticsEvents: prune,
}));
vi.mock('../../../src/lib/dbClient', () => ({ default: {} }));

// What the real catchUp returns: the CATCH_UP_DAYS days before today.
const catchUpResult = (today: string) => {
  const shift = (days: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  return { from: shift(-7), to: shift(-1) };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
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

  it('catches up first when asked, then rolls up only what is left', async () => {
    // 00:30 Ashgabat on 2026-11-27: yesterday is part of the catch-up.
    const now = new Date('2026-11-26T19:30:00Z');
    catchUp.mockResolvedValueOnce(catchUpResult('2026-11-27'));
    expect(await runAnalyticsRollup(now, { catchUp: true })).toEqual([
      '2026-11-27',
    ]);
    expect(catchUp).toHaveBeenCalledWith({ now, onlyMissingPeriods: true });
    expect(rollupDay.mock.calls).toEqual([['2026-11-27', { now }]]);
    expect(catchUp.mock.invocationCallOrder[0]).toBeLessThan(
      rollupDay.mock.invocationCallOrder[0],
    );
  });

  it('catches up on the first run after start-up only, retrying until it succeeds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T05:00:00Z'));
    catchUp.mockResolvedValue(catchUpResult('2026-11-27'));
    const job = createAnalyticsRollupJob();

    catchUp.mockRejectedValueOnce(new Error('db down'));
    await expect(job.run()).rejects.toThrow('db down');
    expect(rollupDay).not.toHaveBeenCalled();

    await job.run();
    await job.run();
    expect(catchUp).toHaveBeenCalledTimes(2);
    expect(rollupDay).toHaveBeenCalledTimes(2);
  });

  it('runs every 10 minutes', () => {
    expect(analyticsRollupJob.schedule).toEqual({
      type: 'interval',
      ms: 600_000,
    });
  });
});

describe('analytics-rollup-nightly', () => {
  it('catches up the last 7 days, then refreshes the older funnels', async () => {
    // 01:30 Ashgabat on 2026-11-27.
    const now = new Date('2026-11-26T20:30:00Z');
    catchUp.mockResolvedValueOnce(catchUpResult('2026-11-27'));
    expect(await runAnalyticsRollupNightly(now)).toEqual({
      rerolledFrom: '2026-11-20',
      rerolledTo: '2026-11-26',
      funnelFrom: '2026-08-30',
      funnelTo: '2026-11-19',
    });
    // Every period touching the re-rolled days, and all revenue: in catchUp
    // (and recounted, not only filled in where missing).
    expect(catchUp).toHaveBeenCalledWith({ now });
    expect(refreshFunnel).toHaveBeenCalledWith('2026-08-30', '2026-11-19', {
      now,
    });
    expect(rollupDay).not.toHaveBeenCalled();
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
