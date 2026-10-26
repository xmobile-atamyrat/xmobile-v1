import type { NextApiRequest, NextApiResponse } from 'next';

import {
  refreshFromCookie,
  verifyToken,
} from '@/pages/api/utils/authMiddleware';
import { ACCESS_SECRET } from '@/pages/api/utils/tokenUtils';
import type { ResponseApi } from '@/pages/lib/types';
import { UserRole } from '@prisma/client';

/** ADMIN or SUPERUSER (shop staff with catalog admin access). */
export function isStaff(grade: UserRole | undefined): boolean {
  return grade === UserRole.ADMIN || grade === UserRole.SUPERUSER;
}

/** SUPERUSER only (destructive / catalog-wide operations). */
export function isSuperuser(grade: UserRole | undefined): boolean {
  return grade === UserRole.SUPERUSER;
}

/** Who passed a bearer check, for routes that log or scope by actor. */
export type BearerActor = {
  userId: string | undefined;
  grade: UserRole | undefined;
};

/**
 * Requires `Authorization: Bearer <access JWT>` whose grade passes `allow`.
 * An expired token is renewed from the refresh cookie the way `withAuth` does,
 * so an admin who left a form open past the access token's lifetime can still
 * save it. Otherwise a missing or invalid token is always 401; a valid token
 * with a disallowed grade gets `rejectStatus`, so each caller keeps its own
 * established contract. Sends JSON `{ success: false, message }` and returns
 * null when rejected, the actor when allowed.
 */
async function requireBearerGrade(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
  allow: (grade: UserRole | undefined) => boolean,
  rejectStatus: 401 | 403,
): Promise<BearerActor | null> {
  const unauthorized = (): null => {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return null;
  };

  const authHeader = req.headers.authorization;
  if (authHeader == null || !authHeader.startsWith('Bearer ')) {
    return unauthorized();
  }
  const token = authHeader.split(' ')[1];
  const secret = ACCESS_SECRET;
  if (secret == null || secret === '') {
    res.status(500).json({
      success: false,
      message: 'Server misconfiguration',
    });
    return null;
  }
  let payload: { userId?: unknown; grade?: UserRole };
  try {
    payload = (await verifyToken(token, secret)) as typeof payload;
  } catch (error) {
    if ((error as Error).name !== 'TokenExpiredError') return unauthorized();
    try {
      payload = await refreshFromCookie(req, res);
    } catch {
      return unauthorized();
    }
  }
  const actor: BearerActor = {
    userId: typeof payload.userId === 'string' ? payload.userId : undefined,
    grade: payload.grade,
  };
  if (!allow(actor.grade)) {
    res.status(rejectStatus).json({
      success: false,
      message: rejectStatus === 403 ? 'Forbidden' : 'Unauthorized',
    });
    return null;
  }
  return actor;
}

/**
 * Requires `Authorization: Bearer <access JWT>` with ADMIN or SUPERUSER.
 * Rejects with 401 (its long-standing contract; clients treat it as "not staff").
 * Use for routes that cannot use `withAuth` (e.g. bodyParser: false / multipart).
 */
export async function requireStaffBearerAuth(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
): Promise<BearerActor | null> {
  return requireBearerGrade(req, res, isStaff, 401);
}

/**
 * Requires `Authorization: Bearer <access JWT>` with SUPERUSER.
 * A valid non-superuser token gets 403 — it is authenticated, just not allowed.
 */
export async function requireSuperuserBearerAuth(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
): Promise<BearerActor | null> {
  return requireBearerGrade(req, res, isSuperuser, 403);
}
