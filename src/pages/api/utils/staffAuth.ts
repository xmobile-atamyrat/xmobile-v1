import type { NextApiRequest, NextApiResponse } from 'next';

import { verifyToken } from '@/pages/api/utils/authMiddleware';
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

type JwtPayloadWithGrade = { grade?: UserRole };

/**
 * Requires `Authorization: Bearer <access JWT>` whose grade passes `allow`.
 * A missing or invalid token is always 401; a valid token with a disallowed
 * grade gets `rejectStatus`, so each caller keeps its own established contract.
 * Sends JSON `{ success: false, message }` and returns false when rejected.
 */
async function requireBearerGrade(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
  allow: (grade: UserRole | undefined) => boolean,
  rejectStatus: 401 | 403,
): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (authHeader == null || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return false;
  }
  const token = authHeader.split(' ')[1];
  const secret = ACCESS_SECRET;
  if (secret == null || secret === '') {
    res.status(500).json({
      success: false,
      message: 'Server misconfiguration',
    });
    return false;
  }
  let grade: UserRole | undefined;
  try {
    const decoded = await verifyToken(token, secret);
    grade = (decoded as JwtPayloadWithGrade).grade;
  } catch {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return false;
  }
  if (!allow(grade)) {
    res.status(rejectStatus).json({
      success: false,
      message: rejectStatus === 403 ? 'Forbidden' : 'Unauthorized',
    });
    return false;
  }
  return true;
}

/**
 * Requires `Authorization: Bearer <access JWT>` with ADMIN or SUPERUSER.
 * Rejects with 401 (its long-standing contract; clients treat it as "not staff").
 * Use for routes that cannot use `withAuth` (e.g. bodyParser: false / multipart).
 */
export async function requireStaffBearerAuth(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
): Promise<boolean> {
  return requireBearerGrade(req, res, isStaff, 401);
}

/**
 * Requires `Authorization: Bearer <access JWT>` with SUPERUSER.
 * A valid non-superuser token gets 403 — it is authenticated, just not allowed.
 */
export async function requireSuperuserBearerAuth(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
): Promise<boolean> {
  return requireBearerGrade(req, res, isSuperuser, 403);
}
