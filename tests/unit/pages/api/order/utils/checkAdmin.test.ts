import { UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkAdmin } from '@/pages/api/order/utils/checkAdmin';

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock('@/lib/dbClient', () => ({
  default: {
    user: { findUnique: mockFindUnique },
  },
}));

describe('checkAdmin', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it('returns false when user is missing', async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await checkAdmin('u1')).toBe(false);
  });

  it('returns false for FREE user', async () => {
    mockFindUnique.mockResolvedValue({ grade: UserRole.FREE });
    expect(await checkAdmin('u1')).toBe(false);
  });

  it('returns true for ADMIN and SUPERUSER', async () => {
    mockFindUnique.mockResolvedValue({ grade: UserRole.ADMIN });
    expect(await checkAdmin('u1')).toBe(true);

    mockFindUnique.mockResolvedValue({ grade: UserRole.SUPERUSER });
    expect(await checkAdmin('u2')).toBe(true);
  });
});
