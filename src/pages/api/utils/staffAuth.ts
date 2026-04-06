import type { NextApiRequest, NextApiResponse } from 'next';

import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { ACCESS_SECRET } from '@/pages/api/utils/tokenUtils';
import type { ResponseApi } from '@/pages/lib/types';
import { UserRole } from '@prisma/client';

/** ADMIN or SUPERUSER (shop staff with catalog admin access). */
export function isStaff(grade: UserRole | undefined): boolean {
  return grade === UserRole.ADMIN || grade === UserRole.SUPERUSER;
}

type JwtPayloadWithGrade = { grade?: UserRole };

/**
 * Requires `Authorization: Bearer <access JWT>` with ADMIN or SUPERUSER.
 * Sends 401 JSON `{ success: false, message }` and returns false when rejected.
 * Use for routes that cannot use `withAuth` (e.g. bodyParser: false / multipart).
 */
export async function requireStaffBearerAuth(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
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
  try {
    const decoded = await verifyToken(token, secret);
    const grade = (decoded as JwtPayloadWithGrade).grade;
    if (!isStaff(grade)) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return false;
  }
}
