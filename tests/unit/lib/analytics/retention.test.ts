import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  analyticsRetentionCutoff,
  pruneAnalyticsEvents,
} from '@/lib/analytics/retention';

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn() }));

vi.mock('@/lib/dbClient', () => ({
  default: { $executeRaw: mockExecute },
}));

describe('analyticsRetentionCutoff', () => {
  it('is exactly 90 days back', () => {
    expect(
      analyticsRetentionCutoff(new Date('2026-11-27T01:30:00Z')).toISOString(),
    ).toBe('2026-08-29T01:30:00.000Z');
  });
});

describe('pruneAnalyticsEvents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stops after a short batch', async () => {
    mockExecute.mockResolvedValueOnce(12);
    expect(await pruneAnalyticsEvents({ batchSize: 100 })).toEqual({
      deleted: 12,
      batches: 1,
    });
  });

  it('keeps deleting full batches until one comes back short', async () => {
    mockExecute
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(3);
    expect(await pruneAnalyticsEvents({ batchSize: 100 })).toEqual({
      deleted: 203,
      batches: 3,
    });
  });

  it('is bounded per run', async () => {
    mockExecute.mockResolvedValue(100);
    expect(
      await pruneAnalyticsEvents({ batchSize: 100, maxBatches: 3 }),
    ).toEqual({ deleted: 300, batches: 3 });
  });

  it('passes the cut-off and batch size as parameters', async () => {
    mockExecute.mockResolvedValueOnce(0);
    await pruneAnalyticsEvents({
      now: new Date('2026-11-27T01:30:00Z'),
      batchSize: 7,
    });
    const sql = mockExecute.mock.calls[0][0];
    expect(sql.values).toEqual(['2026-08-29 01:30:00.000', 7]);
    expect(sql.sql).toContain('DELETE FROM "AnalyticsEvent"');
  });
});
