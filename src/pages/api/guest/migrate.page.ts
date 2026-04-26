import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { GUEST_SESSION_COOKIE_NAME } from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import { migrateGuestDataToUser } from '../order/services/orderService';

const filepath = 'src/pages/api/guest/migrate.page.ts';

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<{ migrated: boolean }>>,
) {
  addCors(res);
  const { method } = req;
  const { userId } = req as AuthenticatedRequest;

  if (method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  try {
    const guestSessionId = req.cookies[GUEST_SESSION_COOKIE_NAME];
    if (!guestSessionId || !userId) {
      return res.status(200).json({ success: true, data: { migrated: false } });
    }

    await migrateGuestDataToUser(userId, guestSessionId);
    return res.status(200).json({ success: true, data: { migrated: true } });
  } catch (error: any) {
    console.error(filepath, error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Guest migration failed',
    });
  }
}

export default withAuth(handler);
