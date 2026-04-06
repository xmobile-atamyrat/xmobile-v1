import { UserRole } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResponseApi } from '@/pages/lib/types';

const verifyTokenMock = vi.fn();

vi.mock('@/pages/api/utils/authMiddleware', () => ({
  verifyToken: (...args: unknown[]) => verifyTokenMock(...args),
}));

vi.mock('@/pages/api/utils/tokenUtils', () => ({
  ACCESS_SECRET: 'unit-staff-access-secret',
}));

import { isStaff, requireStaffBearerAuth } from '@/pages/api/utils/staffAuth';

function createMockRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockImplementation(() => res);
  return res as unknown as NextApiResponse<ResponseApi>;
}

describe('staffAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isStaff', () => {
    it('returns true for ADMIN and SUPERUSER', () => {
      expect(isStaff(UserRole.ADMIN)).toBe(true);
      expect(isStaff(UserRole.SUPERUSER)).toBe(true);
    });

    it('returns false for other grades and undefined', () => {
      expect(isStaff(UserRole.FREE)).toBe(false);
      expect(isStaff(undefined)).toBe(false);
    });
  });

  describe('requireStaffBearerAuth', () => {
    it('returns false and sends 401 when Authorization is missing', async () => {
      const req = {
        headers: {},
      } as unknown as NextApiRequest;
      const res = createMockRes();

      const ok = await requireStaffBearerAuth(req, res);

      expect(ok).toBe(false);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized',
      });
    });

    it('returns false and sends 401 when token verification fails', async () => {
      verifyTokenMock.mockRejectedValueOnce(new Error('invalid'));
      const req = {
        headers: { authorization: 'Bearer bad' },
      } as unknown as NextApiRequest;
      const res = createMockRes();

      const ok = await requireStaffBearerAuth(req, res);

      expect(ok).toBe(false);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns false when grade is not staff', async () => {
      verifyTokenMock.mockResolvedValueOnce({ grade: UserRole.FREE });
      const req = {
        headers: { authorization: 'Bearer valid' },
      } as unknown as NextApiRequest;
      const res = createMockRes();

      const ok = await requireStaffBearerAuth(req, res);

      expect(ok).toBe(false);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns true for ADMIN or SUPERUSER without writing error response', async () => {
      for (const grade of [UserRole.ADMIN, UserRole.SUPERUSER]) {
        verifyTokenMock.mockResolvedValueOnce({ grade });
        const req = {
          headers: { authorization: 'Bearer valid' },
        } as unknown as NextApiRequest;
        const res = createMockRes();

        const ok = await requireStaffBearerAuth(req, res);

        expect(ok).toBe(true);
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
      }
    });
  });
});
