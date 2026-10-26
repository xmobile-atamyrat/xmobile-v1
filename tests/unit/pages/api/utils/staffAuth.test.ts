import { UserRole } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResponseApi } from '@/pages/lib/types';

const verifyTokenMock = vi.fn();
const refreshFromCookieMock = vi.fn();

vi.mock('@/pages/api/utils/authMiddleware', () => ({
  verifyToken: (...args: unknown[]) => verifyTokenMock(...args),
  refreshFromCookie: (...args: unknown[]) => refreshFromCookieMock(...args),
}));

const expired = () =>
  Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' });

vi.mock('@/pages/api/utils/tokenUtils', () => ({
  ACCESS_SECRET: 'unit-staff-access-secret',
}));

import {
  isStaff,
  isSuperuser,
  requireStaffBearerAuth,
  requireSuperuserBearerAuth,
} from '@/pages/api/utils/staffAuth';

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

  describe('isSuperuser', () => {
    it('returns true only for SUPERUSER', () => {
      expect(isSuperuser(UserRole.SUPERUSER)).toBe(true);
      expect(isSuperuser(UserRole.ADMIN)).toBe(false);
      expect(isSuperuser(UserRole.FREE)).toBe(false);
      expect(isSuperuser(undefined)).toBe(false);
    });
  });

  describe('requireStaffBearerAuth', () => {
    it('returns false and sends 401 when Authorization is missing', async () => {
      const req = {
        headers: {},
      } as unknown as NextApiRequest;
      const res = createMockRes();

      const ok = await requireStaffBearerAuth(req, res);

      expect(ok).toBeNull();
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

      expect(ok).toBeNull();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns false when grade is not staff', async () => {
      verifyTokenMock.mockResolvedValueOnce({ grade: UserRole.FREE });
      const req = {
        headers: { authorization: 'Bearer valid' },
      } as unknown as NextApiRequest;
      const res = createMockRes();

      const ok = await requireStaffBearerAuth(req, res);

      expect(ok).toBeNull();
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

        expect(ok).toEqual({ userId: undefined, grade });
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
      }
    });
    it('returns the actor id from the token', async () => {
      verifyTokenMock.mockResolvedValueOnce({
        userId: 'admin-1',
        grade: UserRole.ADMIN,
      });
      const req = {
        headers: { authorization: 'Bearer valid' },
      } as unknown as NextApiRequest;

      const actor = await requireStaffBearerAuth(req, createMockRes());

      expect(actor).toEqual({ userId: 'admin-1', grade: UserRole.ADMIN });
      expect(refreshFromCookieMock).not.toHaveBeenCalled();
    });

    it('renews an expired token from the refresh cookie', async () => {
      verifyTokenMock.mockRejectedValueOnce(expired());
      refreshFromCookieMock.mockResolvedValueOnce({
        userId: 'admin-1',
        grade: UserRole.ADMIN,
      });
      const req = {
        headers: { authorization: 'Bearer stale' },
      } as unknown as NextApiRequest;
      const res = createMockRes();

      const actor = await requireStaffBearerAuth(req, res);

      expect(actor).toEqual({ userId: 'admin-1', grade: UserRole.ADMIN });
      expect(refreshFromCookieMock).toHaveBeenCalledWith(req, res);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('sends 401 when the token expired and the refresh cookie is no good', async () => {
      verifyTokenMock.mockRejectedValueOnce(expired());
      refreshFromCookieMock.mockRejectedValueOnce(new Error('jwt expired'));
      const req = {
        headers: { authorization: 'Bearer stale' },
      } as unknown as NextApiRequest;
      const res = createMockRes();

      const actor = await requireStaffBearerAuth(req, res);

      expect(actor).toBeNull();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('still checks the grade of a renewed token', async () => {
      verifyTokenMock.mockRejectedValueOnce(expired());
      refreshFromCookieMock.mockResolvedValueOnce({
        userId: 'user-1',
        grade: UserRole.FREE,
      });
      const req = {
        headers: { authorization: 'Bearer stale' },
      } as unknown as NextApiRequest;
      const res = createMockRes();

      expect(await requireStaffBearerAuth(req, res)).toBeNull();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('does not try the refresh cookie for a token that is invalid, not expired', async () => {
      verifyTokenMock.mockRejectedValueOnce(new Error('invalid signature'));
      const req = {
        headers: { authorization: 'Bearer forged' },
      } as unknown as NextApiRequest;

      await requireStaffBearerAuth(req, createMockRes());

      expect(refreshFromCookieMock).not.toHaveBeenCalled();
    });
  });

  describe('requireSuperuserBearerAuth', () => {
    it('returns false and sends 401 when Authorization is missing', async () => {
      const req = {
        headers: {},
      } as unknown as NextApiRequest;
      const res = createMockRes();

      const ok = await requireSuperuserBearerAuth(req, res);

      expect(ok).toBeNull();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns false and sends 401 when token verification fails', async () => {
      verifyTokenMock.mockRejectedValueOnce(new Error('invalid'));
      const req = {
        headers: { authorization: 'Bearer bad' },
      } as unknown as NextApiRequest;
      const res = createMockRes();

      const ok = await requireSuperuserBearerAuth(req, res);

      expect(ok).toBeNull();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns false and sends 403 for a valid ADMIN token', async () => {
      verifyTokenMock.mockResolvedValueOnce({ grade: UserRole.ADMIN });
      const req = {
        headers: { authorization: 'Bearer valid' },
      } as unknown as NextApiRequest;
      const res = createMockRes();

      const ok = await requireSuperuserBearerAuth(req, res);

      expect(ok).toBeNull();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden',
      });
    });

    it('returns true for SUPERUSER without writing error response', async () => {
      verifyTokenMock.mockResolvedValueOnce({ grade: UserRole.SUPERUSER });
      const req = {
        headers: { authorization: 'Bearer valid' },
      } as unknown as NextApiRequest;
      const res = createMockRes();

      const ok = await requireSuperuserBearerAuth(req, res);

      expect(ok).toEqual({ userId: undefined, grade: UserRole.SUPERUSER });
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
