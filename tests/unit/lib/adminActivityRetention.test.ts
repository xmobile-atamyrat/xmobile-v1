import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn() }));

vi.mock('@/lib/dbClient', () => ({
  default: { $executeRaw: mockExecute },
}));

import {
  ADMIN_ACTIVITY_RETENTION_MONTHS,
  pruneAdminActivity,
  retentionCutoff,
} from '@/lib/adminActivityRetention';

describe('retentionCutoff', () => {
  it('is 13 calendar months back', () => {
    expect(ADMIN_ACTIVITY_RETENTION_MONTHS).toBe(13);
    expect(
      retentionCutoff(new Date('2026-10-05T03:00:00Z')).toISOString(),
    ).toBe('2025-09-05T03:00:00.000Z');
  });

  it('crosses a year boundary', () => {
    expect(
      retentionCutoff(new Date('2026-02-10T00:00:00Z')).toISOString(),
    ).toBe('2025-01-10T00:00:00.000Z');
  });
});

describe('pruneAdminActivity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stops after the first batch when it was not full', async () => {
    mockExecute.mockResolvedValueOnce(40);
    const result = await pruneAdminActivity({ batchSize: 100 });
    expect(result).toEqual({ deleted: 40, batches: 1 });
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('keeps deleting full batches until one comes back short', async () => {
    mockExecute
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(7);
    const result = await pruneAdminActivity({ batchSize: 100 });
    expect(result).toEqual({ deleted: 207, batches: 3 });
  });

  it('does nothing when no row is old enough', async () => {
    mockExecute.mockResolvedValueOnce(0);
    expect(await pruneAdminActivity({ batchSize: 100 })).toEqual({
      deleted: 0,
      batches: 1,
    });
  });

  it('is bounded per run even if rows keep coming', async () => {
    mockExecute.mockResolvedValue(100);
    const result = await pruneAdminActivity({ batchSize: 100, maxBatches: 4 });
    expect(result).toEqual({ deleted: 400, batches: 4 });
    expect(mockExecute).toHaveBeenCalledTimes(4);
  });
});
