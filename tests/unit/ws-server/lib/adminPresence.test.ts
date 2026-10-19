import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUpdateMany } = vi.hoisted(() => ({ mockUpdateMany: vi.fn() }));

vi.mock('@/lib/dbClient', () => ({
  default: { user: { updateMany: mockUpdateMany } },
}));

import {
  adminUserIdsOnline,
  touchAdminLastSeen,
} from '@/ws-server/lib/adminPresence';
import type { AuthenticatedConnection } from '@/ws-server/lib/types';

const conn = (userId: string, userGrade: string) =>
  ({ userId, userGrade }) as unknown as AuthenticatedConnection;

describe('adminUserIdsOnline', () => {
  it('returns each admin once, however many sockets they hold', () => {
    const sockets = new Set([
      conn('a1', 'ADMIN'),
      conn('a1', 'ADMIN'),
      conn('s1', 'SUPERUSER'),
    ]);
    expect(adminUserIdsOnline(sockets)).toEqual(['a1', 's1']);
  });

  it('is empty when no admin is connected', () => {
    expect(adminUserIdsOnline(new Set())).toEqual([]);
  });
});

describe('touchAdminLastSeen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('does not query when there is nobody to touch', async () => {
    await touchAdminLastSeen([]);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('stamps all given users in one query, staff grades only', async () => {
    const now = new Date('2026-10-05T10:00:00Z');
    await touchAdminLastSeen(['a1', 'a2'], now);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['a1', 'a2'] },
        grade: { in: ['ADMIN', 'SUPERUSER'] },
      },
      data: { lastSeenAt: now },
    });
  });

  it('never throws when the write fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUpdateMany.mockRejectedValue(new Error('db down'));
    await expect(touchAdminLastSeen(['a1'])).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
